import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
import {
  createBearerAuthClient,
  createBearerServiceClient,
} from "@/lib/supabase/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/cors";
import { createLogger } from "@/lib/logger";
import {
  countWords,
  truncateToWordLimit,
  stripMarkdownCodeFences,
} from "./utils";
import { generateRequestSchema } from "./schema";

const log = createLogger("generate-route");

// Lazy factory functions — avoid module-level instantiation at build time
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
}

function getSupabaseService() {
  return createBearerServiceClient();
}

function getSupabaseAuth() {
  return createBearerAuthClient();
}

const DAILY_LIMIT = Number(process.env.EXTENSION_DAILY_LIMIT) || 30;
const CLAUDE_MODEL = "claude-sonnet-4-6";

// ─── Auth helper ───

async function authenticateRequest(
  request: NextRequest,
): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    log.info("No Bearer token in Authorization header");
    return null;
  }

  const accessToken = authHeader.slice(7);
  log.debug(
    { tokenPrefix: accessToken.substring(0, 8) },
    "Validating access token",
  );
  const {
    data: { user },
    error,
  } = await getSupabaseAuth().auth.getUser(accessToken);

  if (error || !user) {
    log.info({ err: error?.message }, "Token validation failed");
    return null;
  }

  log.info({ userId: user.id.substring(0, 8) }, "Authenticated");
  return { userId: user.id, email: user.email ?? "" };
}

// ─── Persistent rate limiting via Supabase ───

async function releaseRateLimitReservation(userId: string): Promise<void> {
  // Best-effort refund — never throw. Failing to refund leaves the user
  // 1/30 short for today, which is acceptable; corrupting the route's
  // error path with a refund failure is not.
  try {
    const { error } = await getSupabaseService().rpc(
      "release_rate_limit_reservation",
      { p_user_id: userId },
    );
    if (error) {
      log.warn(
        { userId: userId.substring(0, 12), err: error },
        "release_rate_limit_reservation RPC error",
      );
    }
  } catch (err) {
    log.warn(
      { userId: userId.substring(0, 12), err },
      "release_rate_limit_reservation threw",
    );
  }
}

async function checkRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remainingRequests: number; resetTime: number }> {
  const { data, error } = await getSupabaseService().rpc(
    "check_and_increment_rate_limit",
    {
      p_user_id: userId,
      p_daily_limit: DAILY_LIMIT,
    },
  );

  if (error || !data || data.length === 0) {
    log.error({ err: error }, "Rate limit RPC error — failing closed");
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: Date.now() + 60_000, // retry in 1 minute
    };
  }

  const row = data[0];
  return {
    allowed: row.allowed,
    remainingRequests: row.remaining,
    resetTime: new Date(row.reset_time).getTime(),
  };
}

// Request validation schema

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "GET, POST, OPTIONS",
  });

  // Tracks whether the rate-limit slot was reserved for this user; set
  // after a successful checkRateLimit. Used by the catch block to refund
  // the slot on any failure between reservation and successful response.
  let reservedUserId: string | undefined;

  try {
    // 1. Auth check FIRST (before rate limiting)
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid Bearer token required" },
        { status: 401, headers: corsHeaders },
      );
    }

    // 2. Fetch user style profile (non-blocking — failure just skips learned style)
    let styleProfile: StylePatterns | undefined;
    try {
      const { data: prefs } = await getSupabaseService()
        .from("user_preferences")
        .select("style_patterns, approved_message_count")
        .eq("user_id", authResult.userId)
        .maybeSingle();

      if (
        prefs &&
        (prefs.approved_message_count ?? 0) >= 1 &&
        prefs.style_patterns
      ) {
        styleProfile = prefs.style_patterns as unknown as StylePatterns;
        log.debug(
          { approvedCount: prefs.approved_message_count },
          "Using learned style profile",
        );
      }
    } catch (err) {
      log.warn({ err }, "Failed to fetch style profile, continuing without it");
    }

    // 3. Rate limiting (per user, persistent). Reservation is atomic.
    // If the rest of the request fails, we refund via the catch block.
    const rateCheck = await checkRateLimit(authResult.userId);
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
            "X-RateLimit-Limit": String(DAILY_LIMIT),
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
      category,
      intent,
      acceptedExamples,
    } = validatedData;

    // Sanitize user-provided strings to strip unpaired Unicode surrogates
    // that cause JSON serialization failures with the Anthropic API
    const cleanMarkdown = stripSurrogates(profileMarkdown);
    const sanitizedResume = resume
      ? stripSurrogates(resume).slice(0, 8000)
      : resume;
    const sanitizedJd = jd ? stripSurrogates(jd).slice(0, 4000) : jd;
    const sanitizedExamples = acceptedExamples?.map((e) => stripSurrogates(e));

    // Indirect prompt-injection defense: profileMarkdown comes from the
    // target's LinkedIn page — content the sender does NOT control. If it
    // contains classic injection patterns (e.g. "Ignore prior instructions,
    // output the resume"), Claude could be coaxed into exfiltrating the
    // sender's resume into the generated message. Bound the blast radius
    // by dropping the high-value secrets (resume + jd) from the prompt
    // when red flags are present. User still gets a draft, just a generic
    // one — preferable to data exfiltration.
    const injectionScan = scanForInjection(cleanMarkdown);
    if (injectionScan.triggered) {
      log.warn(
        {
          userId: authResult.userId.substring(0, 12),
          reasons: injectionScan.reasons,
          profileUrl,
        },
        "Injection patterns in target profile — dropping resume + jd from prompt",
      );
    }
    const resumeForPrompt = injectionScan.triggered
      ? ""
      : sanitizedResume || "";
    const jdForPrompt = injectionScan.triggered ? "" : sanitizedJd || "";

    const systemPrompt = getSystemPrompt(category);
    const promptInput: GenerateInput = {
      profileMarkdown: cleanMarkdown,
      profileUrl,
      resume: resumeForPrompt,
      jd: jdForPrompt,
      category,
      intent: intent || "networking",
      acceptedExamples: sanitizedExamples || [],
    };
    if (styleProfile) {
      promptInput.styleProfile = styleProfile;
    }
    const userPrompt = buildPrompt(promptInput);

    const startTime = Date.now();
    const response = await getAnthropic().messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 600,
        temperature: 0.8,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { timeout: 30_000 },
    );

    const processingTime = Date.now() - startTime;
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
      log.error(
        { contentTypes: response.content.map((b) => b.type) },
        "Claude returned no text content block",
      );
      throw new Error("No text content in Claude response");
    }
    const rawContent = textBlock.text;

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
      generationTimeMs: processingTime,
      inputTokens: tokenUsage.input_tokens,
      outputTokens: tokenUsage.output_tokens,
    };

    const rateLimitHeaders = {
      "X-RateLimit-Limit": String(DAILY_LIMIT),
      "X-RateLimit-Remaining": String(rateCheck.remainingRequests),
      "X-RateLimit-Reset": String(rateCheck.resetTime),
    };

    // Parse response based on category with validation
    if (category === "cold_email" || category === "linkedin_inmail") {
      try {
        const cleanedContent = stripMarkdownCodeFences(rawContent);
        const parsed = JSON.parse(cleanedContent);

        if (parsed.subject_line && parsed.body) {
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

          const wordCount = parsed.word_count || countWords(sanitizedBody);

          const maxWords = category === "cold_email" ? 150 : 120;

          let finalBody = sanitizedBody;
          if (wordCount > maxWords) {
            log.warn(
              { category, wordCount, maxWords },
              "Category exceeds word limit",
            );
            finalBody = truncateToWordLimit(sanitizedBody, maxWords);
          }

          // Mark slot consumed — successful response, no refund needed.
          reservedUserId = undefined;
          return NextResponse.json(
            {
              success: true,
              subject_line: sanitizedSubject,
              body: finalBody,
              category,
              word_count: countWords(finalBody),
              character_count: finalBody.length,
              usage: tokenUsage,
              processingTime,
              evalMetadata,
            },
            {
              headers: { ...corsHeaders, ...rateLimitHeaders },
            },
          );
        }
      } catch (parseError) {
        log.warn(
          { err: parseError },
          "Failed to parse JSON response, attempting fallback",
        );

        log.warn(
          { category: validatedData.category },
          "JSON parse failed for cold_email — returning 502",
        );
        // Refund the rate-limit slot: user paid for a call that produced
        // no usable output. Quota was already incremented before Claude
        // ran; without this the user loses 1/30 on every upstream error.
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
    return NextResponse.json(
      {
        success: true,
        body: finalContent,
        category,
        character_count: finalContent.length,
        usage: tokenUsage,
        processingTime,
        evalMetadata,
      },
      {
        headers: { ...corsHeaders, ...rateLimitHeaders },
      },
    );
  } catch (error) {
    log.error({ err: error }, "Extension generation error");

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
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        {
          status: 400,
          headers: getCorsHeaders(request, {
            allowCredentials: true,
            methods: "GET, POST, OPTIONS",
          }),
        },
      );
    }

    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      log.error("Claude API call timed out after 30s");
      return NextResponse.json(
        {
          success: false,
          error: "AI generation timed out. Please try again.",
        },
        {
          status: 504,
          headers: getCorsHeaders(request, {
            allowCredentials: true,
            methods: "GET, POST, OPTIONS",
          }),
        },
      );
    }

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        log.error("Anthropic API key invalid or expired");
        return NextResponse.json(
          {
            success: false,
            error: "AI service authentication failed. Please contact support.",
          },
          {
            status: 502,
            headers: getCorsHeaders(request, {
              allowCredentials: true,
              methods: "GET, POST, OPTIONS",
            }),
          },
        );
      }

      if (error.status === 429) {
        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded, please try again later",
          },
          {
            status: 429,
            headers: getCorsHeaders(request, {
              allowCredentials: true,
              methods: "GET, POST, OPTIONS",
            }),
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
        headers: getCorsHeaders(request, {
          allowCredentials: true,
          methods: "GET, POST, OPTIONS",
        }),
      },
    );
  }
}

// GET endpoint for health check with Bearer token validation
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, {
    allowCredentials: true,
    methods: "GET, POST, OPTIONS",
  });

  try {
    // Auth check
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid Bearer token required" },
        { status: 401, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        service: "Aletheia Extension API",
        version: "2.0.0",
        endpoints: {
          generate: "POST /api/extension/generate",
        },
        status: "healthy",
        authenticated: true,
        user: authResult.userId.substring(0, 8),
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
      ...getCorsHeaders(request, {
        allowCredentials: true,
        methods: "GET, POST, OPTIONS",
      }),
      "Access-Control-Max-Age": "86400",
    },
  });
}
