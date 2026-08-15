import { NextRequest, NextResponse } from "next/server";
import {
  getSystemPrompt,
  buildPrompt,
  sanitize,
  PROMPT_VERSION,
  type GenerateInput,
} from "@/lib/ai/prompts/linkedin-connection";
import type { StylePatterns } from "@/lib/ai/style-analyzer";
import {
  sanitizeForLinkedIn,
  stripSurrogates,
  stripModelPreambleAndSuffix,
} from "@/lib/ai/sanitizer";
import { scanForInjection } from "@/lib/ai/prompts/injection-heuristic";
import { deriveSafeCandidateSummary } from "@/lib/ai/candidate-summary";
import {
  formatGeneratedEmailBody,
  getEmailWordLimit,
} from "@/lib/ai/email-formatter";
import {
  CREDIT_BILLING_ENABLED,
  grantTrialCreditsOnce,
  isBillableGenerationCategory,
  isUnlimitedCreditUser,
  reserveGenerationCredits,
} from "@/lib/billing/credits";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import {
  CURRENT_EXTENSION_API_VERSION,
  evaluateExtensionContract,
} from "@/lib/extension-contract";
import {
  generateRequestSchema,
  ycApplicationRequestSchema,
} from "@/app/api/extension/generate/schema";
import {
  countWords,
  truncateToWordLimit,
} from "@/app/api/extension/generate/utils";
import {
  contractFailureResponse,
  createGenerateCorsHeaders,
  createRateLimitHeaders,
  toZodErrorDetails,
} from "@/modules/outreach/api/extension-generate.mapper";
import type {
  ReservedCredit,
  ResumeSource,
} from "@/modules/outreach/domain/extension-generate.types";
import {
  CLAUDE_MODEL,
  createOutreachDraftMessage,
  getAnthropicApiErrorStatus,
  getEmailDraftToolInput,
  isAnthropicTimeoutError,
} from "@/modules/outreach/infrastructure/anthropic.repository";
import {
  authenticateExtensionRequest,
  checkGenerationRateLimit,
  getDailyLimit,
  getPrimaryResumeForGeneration,
  getProfileTargetJobDescription,
  getSupabaseService,
  getUserStyleProfile,
  refundCreditReservation,
  releaseRateLimitReservation,
} from "@/modules/outreach/infrastructure/extension-generate.repository";
import { generateYcApplication } from "@/modules/application-answer/application/generate-yc-application.service";

const log = createLogger("generate-route");

export async function POST(request: NextRequest) {
  const corsHeaders = createGenerateCorsHeaders(request);

  // Tracks whether the rate-limit slot was reserved for this user; set
  // after a successful checkRateLimit. Used by the catch block to refund
  // the slot on any failure between reservation and successful response.
  let reservedUserId: string | undefined;
  let reservedCredit: ReservedCredit | undefined;
  let creditCost: number | undefined;
  let creditsRemaining: number | null | undefined;
  let billingMode: "credits" | "unlimited_developer" | undefined;

  try {
    const contract = evaluateExtensionContract(request.headers);
    if (!contract.compatible) {
      return contractFailureResponse(contract, corsHeaders);
    }

    // 1. Auth check FIRST (before rate limiting)
    const authResult = await authenticateExtensionRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid Bearer token required" },
        { status: 401, headers: corsHeaders },
      );
    }

    // YC is additive to API v1, but owns a stricter lifecycle: validate and
    // prepare caller-scoped grounding before rate limiting or billing. Clone
    // the request so legacy categories retain their established parse order.
    const dispatchBody = await request
      .clone()
      .json()
      .catch(() => null);
    if (
      dispatchBody &&
      typeof dispatchBody === "object" &&
      "category" in dispatchBody &&
      dispatchBody.category === "yc_application"
    ) {
      const parsed = ycApplicationRequestSchema.safeParse(dispatchBody);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid request",
            code: "INVALID_REQUEST",
            details: toZodErrorDetails(parsed.error),
          },
          { status: 400, headers: corsHeaders },
        );
      }

      return generateYcApplication({
        caller: authResult,
        request: parsed.data,
        corsHeaders,
        applicationBaseUrl:
          process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin,
      });
    }

    // 2. Fetch user style profile (non-blocking — failure just skips learned style)
    let styleProfile: StylePatterns | undefined;
    try {
      styleProfile = await getUserStyleProfile(authResult.userId);
    } catch (err) {
      log.warn({ err }, "Failed to fetch style profile, continuing without it");
    }

    // 3. Rate limiting (per user, persistent). Reservation is atomic.
    // If the rest of the request fails, we refund via the catch block.
    const rateCheck = await checkGenerationRateLimit(authResult.userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Daily limit reached",
          message:
            "You have exceeded the 30 requests per day limit. Please try again tomorrow.",
          resetTime: rateCheck.resetTime,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "X-RateLimit-Limit": String(getDailyLimit()),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateCheck.resetTime),
          },
        },
      );
    }
    // Mark the slot reserved so a downstream failure can refund it.
    reservedUserId = authResult.userId;

    // 3. Parse and validate request
    const body = await request.json();
    const validatedData = generateRequestSchema.parse(body);

    const {
      profileMarkdown,
      profileUrl,
      resume,
      jd,
      conversationContext,
      category,
      intent,
      emailMode,
      acceptedExamples,
    } = validatedData;

    const unlimitedCreditUser = isUnlimitedCreditUser(authResult.email);

    if (CREDIT_BILLING_ENABLED && isBillableGenerationCategory(category)) {
      if (unlimitedCreditUser) {
        creditCost = 0;
        creditsRemaining = null;
        billingMode = "unlimited_developer";
        log.info(
          { userId: authResult.userId.substring(0, 12), category },
          "Unlimited developer credits applied",
        );
      } else {
        const billingClient = getSupabaseService();
        await grantTrialCreditsOnce(billingClient, authResult.userId);
        const reservation = await reserveGenerationCredits(
          billingClient,
          authResult.userId,
          category,
        );
        creditCost = reservation.cost;
        creditsRemaining = reservation.balanceAfter;
        billingMode = "credits";

        if (!reservation.allowed || !reservation.reservationId) {
          await releaseRateLimitReservation(authResult.userId);
          reservedUserId = undefined;
          return NextResponse.json(
            {
              success: false,
              error: "Insufficient credits",
              code: "INSUFFICIENT_CREDITS",
              message:
                "You are out of credits. Buy more credits in the Aletheia dashboard.",
              billingMode: "credits",
              creditCost,
              creditsRemaining,
            },
            {
              status: 402,
              headers: {
                ...corsHeaders,
                "X-RateLimit-Limit": String(getDailyLimit()),
                "X-RateLimit-Remaining": String(rateCheck.remainingRequests),
                "X-RateLimit-Reset": String(rateCheck.resetTime),
              },
            },
          );
        }

        reservedCredit = {
          userId: authResult.userId,
          reservationId: reservation.reservationId,
          amount: reservation.cost,
        };
      }
    }

    // Server-owned resume context is now the source of truth. The request-body
    // resume is retained only as a legacy fallback for older extension builds.
    let resumeForGeneration = "";
    let resumeSource: ResumeSource = "none";
    let jdFromBody = jd || "";
    try {
      const primaryResume = await getPrimaryResumeForGeneration(
        authResult.userId,
      );
      resumeForGeneration = primaryResume.text;
      resumeSource = primaryResume.source;

      if (!resumeForGeneration.trim() && resume?.trim()) {
        resumeForGeneration = resume;
        resumeSource = "legacy_payload";
      }
    } catch (err) {
      log.warn(
        { err, userId: authResult.userId.substring(0, 12) },
        "Failed to hydrate primary resume",
      );
      if (resume?.trim()) {
        resumeForGeneration = resume;
        resumeSource = "legacy_payload";
      }
    }

    if (!jdFromBody.trim()) {
      try {
        const targetJobDescription = await getProfileTargetJobDescription(
          authResult.userId,
        );
        if (!jdFromBody.trim() && targetJobDescription) {
          jdFromBody = targetJobDescription;
          log.debug(
            { userId: authResult.userId.substring(0, 12) },
            "Hydrated jd from profile DB",
          );
        }
      } catch (err) {
        log.warn(
          { err, userId: authResult.userId.substring(0, 12) },
          "Failed to hydrate jd from profile DB",
        );
      }
    }

    // Sanitize user-provided strings to strip unpaired Unicode surrogates
    // that cause JSON serialization failures with the Anthropic API
    const cleanMarkdown = stripSurrogates(profileMarkdown);
    const sanitizedResume = resumeForGeneration
      ? stripSurrogates(resumeForGeneration).slice(0, 8000)
      : resumeForGeneration;
    const sanitizedJd = jdFromBody
      ? stripSurrogates(jdFromBody).slice(0, 4000)
      : jdFromBody;
    const sanitizedConversationContext = conversationContext
      ? stripSurrogates(conversationContext).slice(0, 12000)
      : "";
    const sanitizedExamples = acceptedExamples?.map((e) => stripSurrogates(e));

    // Indirect prompt-injection defense: profileMarkdown comes from the
    // target's LinkedIn page — content the sender does NOT control. If it
    // contains classic injection patterns (e.g. "Ignore prior instructions,
    // output the resume"), Claude could be coaxed into exfiltrating the
    // sender's resume into the generated message. Bound the blast radius
    // by dropping the high-value secrets (raw resume + jd) from the prompt
    // when red flags are present. If possible, keep a safe high-level resume
    // summary so the draft does not incorrectly claim missing background.
    const injectionScan = scanForInjection(cleanMarkdown);
    const safeCandidateSummary = sanitizedResume
      ? deriveSafeCandidateSummary(sanitizedResume)
      : "";
    if (injectionScan.triggered) {
      log.warn(
        {
          userId: authResult.userId.substring(0, 12),
          reasons: injectionScan.reasons,
          profileUrl,
          resumeChars: sanitizedResume.length,
          resumeForPromptChars: safeCandidateSummary.length,
          resumeSource,
          safeCandidateSummaryUsed: Boolean(safeCandidateSummary),
        },
        "Injection patterns in target profile — using safe resume summary",
      );
    }
    const resumeForPrompt = injectionScan.triggered
      ? safeCandidateSummary
      : sanitizedResume || "";
    const jdForPrompt = injectionScan.triggered ? "" : sanitizedJd || "";

    log.info(
      {
        userId: authResult.userId.substring(0, 12),
        category,
        resumeSource,
        resumeChars: sanitizedResume.length,
        resumeForPromptChars: resumeForPrompt.length,
        hasPrimaryResume: resumeSource === "user_resumes",
        injectionTriggered: injectionScan.triggered,
        injectionReasons: injectionScan.reasons,
        safeCandidateSummaryUsed:
          injectionScan.triggered && Boolean(safeCandidateSummary),
      },
      "Prepared generation context",
    );

    const systemPrompt = getSystemPrompt(category);
    const promptInput: GenerateInput = {
      profileMarkdown: cleanMarkdown,
      profileUrl,
      resume: resumeForPrompt,
      jd: jdForPrompt,
      conversationContext: sanitizedConversationContext,
      category,
      intent: intent || "networking",
      emailMode,
      acceptedExamples: sanitizedExamples || [],
    };
    if (styleProfile) {
      promptInput.styleProfile = styleProfile;
    }
    const userPrompt = buildPrompt(promptInput);
    const shouldUseEmailDraftTool =
      category === "cold_email" || category === "linkedin_inmail";

    const startTime = Date.now();
    const response = await createOutreachDraftMessage({
      systemPrompt,
      userPrompt,
      useEmailDraftTool: shouldUseEmailDraftTool,
    });

    const processingTime = Date.now() - startTime;
    const textBlock = response.content.find((block) => block.type === "text");
    const rawContent =
      textBlock && textBlock.type === "text" ? textBlock.text : "";

    const tokenUsage = response.usage;
    const totalTokens = tokenUsage.input_tokens + tokenUsage.output_tokens;

    log.info(
      {
        userId: authResult.userId.substring(0, 8),
        inputTokens: tokenUsage.input_tokens,
        outputTokens: tokenUsage.output_tokens,
        totalTokens,
        processingTime,
        category,
        promptVersion: PROMPT_VERSION,
        apiVersion: contract.apiVersion,
        extensionVersion: contract.extensionVersion,
        legacyExtensionClient: contract.legacyClient,
      },
      "Generation completed",
    );

    // Eval metadata — echoed back to client, sent back in feedback payload,
    // ultimately persisted in user_feedback.metadata for per-version eval analysis.
    const evalMetadata = {
      promptVersion: PROMPT_VERSION,
      model: CLAUDE_MODEL,
      temperature: 0.8,
      category,
      intent: intent ?? "networking",
      emailMode,
      generationTimeMs: processingTime,
      inputTokens: tokenUsage.input_tokens,
      outputTokens: tokenUsage.output_tokens,
      resumeSource,
      hasPrimaryResume: resumeSource === "user_resumes",
      injectionTriggered: injectionScan.triggered,
      safeCandidateSummaryUsed:
        injectionScan.triggered && Boolean(safeCandidateSummary),
    };

    const rateLimitHeaders = createRateLimitHeaders({
      ...rateCheck,
      dailyLimit: getDailyLimit(),
    });

    // Parse response based on category with validation
    if (category === "cold_email" || category === "linkedin_inmail") {
      try {
        const parsed = getEmailDraftToolInput(response);
        const basicSubjectSanitization = sanitize(
          stripModelPreambleAndSuffix(parsed.subject_line),
        );
        const basicBodySanitization = sanitize(
          stripModelPreambleAndSuffix(parsed.body),
        );

        const enhancedSubjectSanitization = await sanitizeForLinkedIn(
          basicSubjectSanitization,
        );
        const enhancedBodySanitization = await sanitizeForLinkedIn(
          basicBodySanitization,
        );

        const sanitizedSubject = enhancedSubjectSanitization.success
          ? enhancedSubjectSanitization.sanitizedContent
          : basicSubjectSanitization;
        const sanitizedBody = enhancedBodySanitization.success
          ? enhancedBodySanitization.sanitizedContent
          : basicBodySanitization;

        const subjectPatterns =
          enhancedSubjectSanitization.aiFingerprints?.detectedPatterns ?? [];
        const bodyPatterns =
          enhancedBodySanitization.aiFingerprints?.detectedPatterns ?? [];

        if (subjectPatterns.length || bodyPatterns.length) {
          log.info(
            {
              subjectPatterns,
              bodyPatterns,
              category: validatedData.category,
            },
            "AI fingerprints stripped in Chrome extension generation",
          );
        }

        let finalBody = formatGeneratedEmailBody(sanitizedBody, {
          category,
          mode: emailMode,
        });
        let wordCount = countWords(finalBody);
        const { max: maxWords } = getEmailWordLimit(category, emailMode);
        if (wordCount > maxWords) {
          log.warn(
            { category, wordCount, maxWords },
            "Category exceeds word limit",
          );
          finalBody = truncateToWordLimit(finalBody, maxWords);
          wordCount = countWords(finalBody);
        }

        // Mark slot consumed — successful response, no refund needed.
        reservedUserId = undefined;
        reservedCredit = undefined;
        return NextResponse.json(
          {
            success: true,
            subject_line: sanitizedSubject,
            body: finalBody,
            category,
            word_count: wordCount,
            character_count: finalBody.length,
            usage: tokenUsage,
            processingTime,
            evalMetadata,
            ...(CREDIT_BILLING_ENABLED
              ? {
                  billingMode,
                  creditCost,
                  creditsRemaining,
                  unlimitedCredits: unlimitedCreditUser,
                }
              : {}),
          },
          {
            headers: { ...corsHeaders, ...rateLimitHeaders },
          },
        );
      } catch (parseError) {
        log.warn(
          { err: parseError },
          "Failed to validate email draft tool response",
        );

        log.warn(
          { category: validatedData.category },
          "Email draft tool response invalid — returning 502",
        );
        // Refund the rate-limit slot: user paid for a call that produced
        // no usable output. Quota was already incremented before Claude
        // ran; without this the user loses 1/30 on every upstream error.
        if (reservedCredit) {
          await refundCreditReservation(reservedCredit, "parse_failed");
          reservedCredit = undefined;
        }
        await releaseRateLimitReservation(authResult.userId);
        reservedUserId = undefined;
        return NextResponse.json(
          {
            error: "Generation format error, please retry",
            code: "PARSE_FAILED",
          },
          { status: 502, headers: { ...corsHeaders, ...rateLimitHeaders } },
        );
      }
    }

    // For LinkedIn connections - apply AI fingerprint detection and sanitization
    if (!rawContent) {
      log.error(
        { contentTypes: response.content.map((b) => b.type) },
        "Claude returned no text content block",
      );
      throw new Error("No text content in Claude response");
    }
    const basicSanitization = sanitize(stripModelPreambleAndSuffix(rawContent));
    const enhancedSanitization = await sanitizeForLinkedIn(basicSanitization);
    const sanitizedContent = enhancedSanitization.success
      ? enhancedSanitization.sanitizedContent
      : basicSanitization;

    const linkedinPatterns =
      enhancedSanitization.aiFingerprints?.detectedPatterns ?? [];
    if (linkedinPatterns.length) {
      log.info(
        {
          patterns: linkedinPatterns,
          category: validatedData.category,
        },
        "AI fingerprints stripped in LinkedIn connection generation",
      );
    }

    let finalContent = sanitizedContent;

    if (finalContent.length > 300) {
      const within300 = finalContent.substring(0, 300);
      const lastPeriod = within300.lastIndexOf(".");

      if (lastPeriod > 150) {
        finalContent = finalContent.substring(0, lastPeriod + 1).trim();
      } else {
        const lastSpace = within300.lastIndexOf(" ");
        finalContent = finalContent
          .substring(0, lastSpace > 0 ? lastSpace : 297)
          .trim();
      }

      log.info(
        { truncatedLength: finalContent.length },
        "LinkedIn message truncated at sentence boundary",
      );
    }

    // Mark slot consumed — successful response, no refund needed.
    reservedUserId = undefined;
    reservedCredit = undefined;
    return NextResponse.json(
      {
        success: true,
        body: finalContent,
        category,
        character_count: finalContent.length,
        usage: tokenUsage,
        processingTime,
        evalMetadata,
        ...(CREDIT_BILLING_ENABLED
          ? {
              billingMode,
              creditCost,
              creditsRemaining,
              unlimitedCredits: unlimitedCreditUser,
            }
          : {}),
      },
      {
        headers: { ...corsHeaders, ...rateLimitHeaders },
      },
    );
  } catch (error) {
    log.error({ err: error }, "Extension generation error");

    if (reservedCredit) {
      await refundCreditReservation(
        reservedCredit,
        error instanceof Error ? error.name : "unknown_error",
      );
      reservedCredit = undefined;
    }

    // If a rate-limit slot was reserved but we never returned a successful
    // response, refund it. Otherwise an Anthropic 5xx or Zod validation
    // failure silently burns 1/30 daily quota.
    if (reservedUserId) {
      await releaseRateLimitReservation(reservedUserId);
      reservedUserId = undefined;
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: toZodErrorDetails(error),
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (isAnthropicTimeoutError(error)) {
      log.error("Claude API call timed out after 30s");
      return NextResponse.json(
        {
          success: false,
          error: "AI generation timed out. Please try again.",
        },
        {
          status: 504,
          headers: corsHeaders,
        },
      );
    }

    const anthropicStatus = getAnthropicApiErrorStatus(error);
    if (anthropicStatus !== null) {
      if (anthropicStatus === 401) {
        log.error("Anthropic API key invalid or expired");
        return NextResponse.json(
          {
            success: false,
            error: "AI service authentication failed. Please contact support.",
          },
          {
            status: 502,
            headers: corsHeaders,
          },
        );
      }

      if (anthropicStatus === 429) {
        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded, please try again later",
          },
          {
            status: 429,
            headers: corsHeaders,
          },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate content",
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}

// GET endpoint for health check with Bearer token validation
export async function GET(request: NextRequest) {
  const corsHeaders = createGenerateCorsHeaders(request);

  try {
    // Auth check
    const authResult = await authenticateExtensionRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid Bearer token required" },
        { status: 401, headers: corsHeaders },
      );
    }

    let resumeStatus = {
      has_primary: false,
      source: "none" as "user_resumes" | "profiles" | "none",
      parsed_text_chars: 0,
    };

    try {
      const primaryResume = await getPrimaryResumeForGeneration(
        authResult.userId,
      );
      resumeStatus = {
        has_primary: primaryResume.source !== "none",
        source: primaryResume.source,
        parsed_text_chars: primaryResume.text.length,
      };
    } catch (err) {
      log.warn(
        { err, userId: authResult.userId.substring(0, 12) },
        "Failed to fetch resume status",
      );
    }

    return NextResponse.json(
      {
        service: "Aletheia Extension API",
        version: CURRENT_EXTENSION_API_VERSION,
        apiVersion: CURRENT_EXTENSION_API_VERSION,
        endpoints: {
          generate: "POST /api/extension/generate",
        },
        status: "healthy",
        authenticated: true,
        user: authResult.userId.substring(0, 8),
        resume: resumeStatus,
      },
      {
        headers: corsHeaders,
      },
    );
  } catch (error) {
    log.error({ err: error }, "GET endpoint error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      ...createGenerateCorsHeaders(request),
      "Access-Control-Max-Age": "86400",
    },
  });
}
