import { randomUUID } from "node:crypto";
import type { GenerationTiming } from "@/lib/generation-timing";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ycApplicationGenerationResultSchema,
  formatApplicationAnswers,
  ycApplicationReadinessFailureSchema,
  type YcApplicationRequest,
} from "@/app/api/extension/generate/schema";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import {
  buildYcApplicationPrompt,
  YC_APPLICATION_PROMPT_VERSION,
} from "@/lib/ai/prompts/yc-application";
import {
  CREDIT_BILLING_ENABLED,
  grantTrialCreditsOnce,
  isUnlimitedCreditUser,
  reserveGenerationCredits,
  type CreditReservation,
} from "@/lib/billing/credits";
import type { AuthenticatedExtensionUser } from "@/modules/outreach/domain/extension-generate.types";
import {
  CLAUDE_MODEL,
  getAnthropicApiErrorStatus,
  isAnthropicTimeoutError,
  isAnthropicAbortError,
} from "@/modules/outreach/infrastructure/anthropic.repository";
import {
  checkGenerationRateLimit,
  getDailyLimit,
  getSupabaseService,
  refundCreditReservation,
  recordApplicationRefundFailure,
  releaseRateLimitReservation,
} from "@/modules/outreach/infrastructure/extension-generate.repository";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import {
  YC_GENERATION_SETTINGS,
  createYcApplicationDraft,
  getYcApplicationToolInput,
  getApplicationBatchToolInput,
  getApplicationOutputBudget,
  type YcApplicationToolOutput,
  YcApplicationStructuredOutputError,
} from "../infrastructure/anthropic-yc.repository";
import { prepareYcGroundingContext } from "./prepare-yc-grounding-context";
import {
  sanitizeYcApplicationOutput,
  type SanitizedYcApplicationOutput,
  YcApplicationOutputSanitizationError,
} from "./sanitize-yc-application-output";
import {
  validateYcApplicationOutput,
  YcApplicationOutputValidationError,
} from "./validate-yc-application-output";

type RateLimitResult = Awaited<ReturnType<typeof checkGenerationRateLimit>>;
const log = createLogger("yc-application-generation");

export type GenerateYcApplicationDependencies = {
  prepareGrounding: (_input: {
    caller: { accessToken: string; userId: string };
    question: string;
    questions?: string[];
    jobDescription: string;
    timing?: GenerationTiming;
    logger?: SafeLogger;
  }) => Promise<YcGroundingContext>;
  checkRateLimit: (_userId: string) => Promise<RateLimitResult>;
  getDailyLimit: () => number;
  billingEnabled: boolean;
  isUnlimitedUser: (_email: string | null | undefined) => boolean;
  grantTrialCredits: (
    _userId: string,
  ) => Promise<{ granted: boolean; balance: number }>;
  reserveCredits: (_userId: string) => Promise<CreditReservation>;
  releaseRateLimit: (_userId: string, _logger?: SafeLogger) => Promise<unknown>;
  refundCredits: (
    _credit: { userId: string; reservationId: string; amount: number },
    _reason: string,
    _logger?: SafeLogger,
  ) => Promise<boolean>;
  recordRefundFailure: typeof recordApplicationRefundFailure;
  createMessage: typeof createYcApplicationDraft;
  parseMessage: (
    _message: Awaited<ReturnType<typeof createYcApplicationDraft>>,
  ) => YcApplicationToolOutput;
  sanitizeOutput: (
    _output: YcApplicationToolOutput,
  ) => Promise<SanitizedYcApplicationOutput>;
  now: () => number;
  randomUuid: () => string;
  model: string;
};

const defaultDependencies: GenerateYcApplicationDependencies = {
  prepareGrounding: prepareYcGroundingContext,
  checkRateLimit: checkGenerationRateLimit,
  getDailyLimit,
  billingEnabled: CREDIT_BILLING_ENABLED,
  isUnlimitedUser: isUnlimitedCreditUser,
  grantTrialCredits: (userId) =>
    grantTrialCreditsOnce(getSupabaseService(), userId),
  reserveCredits: (userId) =>
    reserveGenerationCredits(getSupabaseService(), userId, "yc_application"),
  releaseRateLimit: releaseRateLimitReservation,
  refundCredits: refundCreditReservation,
  recordRefundFailure: recordApplicationRefundFailure,
  createMessage: createYcApplicationDraft,
  parseMessage: getYcApplicationToolInput,
  sanitizeOutput: sanitizeYcApplicationOutput,
  now: Date.now,
  randomUuid: randomUUID,
  model: CLAUDE_MODEL,
};

function rateLimitHeaders(
  rate: RateLimitResult,
  dependencies: GenerateYcApplicationDependencies,
) {
  return {
    "X-RateLimit-Limit": String(dependencies.getDailyLimit()),
    "X-RateLimit-Remaining": String(rate.remainingRequests),
    "X-RateLimit-Reset": String(rate.resetTime),
  };
}

function profileUrl(baseUrl: string): string {
  return new URL(
    "/profile/application",
    `${baseUrl.replace(/\/$/u, "")}/`,
  ).toString();
}

async function releaseReservations(input: {
  dependencies: GenerateYcApplicationDependencies;
  caller: AuthenticatedExtensionUser;
  reservedCredit:
    | {
        userId: string;
        reservationId: string;
        amount: number;
      }
    | undefined;
  rateReserved: boolean;
  reason: string;
  logger: SafeLogger;
}) {
  const [credit, quota] = await Promise.allSettled([
    input.reservedCredit
      ? input.dependencies.refundCredits(
          input.reservedCredit,
          input.reason,
          input.logger,
        )
      : Promise.resolve(true),
    input.rateReserved
      ? input.dependencies.releaseRateLimit(input.caller.userId, input.logger)
      : Promise.resolve(true),
  ]);
  const refunded = credit.status === "fulfilled" && credit.value === true;
  if (input.reservedCredit && !refunded) {
    try {
      await input.dependencies.recordRefundFailure(
        input.reservedCredit,
        input.reason,
        input.logger,
      );
    } catch {
      input.logger.error(
        {
          errorCode: "REFUND_RECONCILIATION_RECORD_FAILED",
          reservationId: input.reservedCredit.reservationId,
        },
        "Refund remains pending",
      );
    }
  }
  const quotaReleased = quota.status === "fulfilled" && quota.value === true;
  if (!quotaReleased)
    input.logger.error(
      { errorCode: "RATE_LIMIT_RELEASE_FAILED", userId: input.caller.userId },
      "Daily slot release needs review; do not retry blindly",
    );
  return {
    billing: !input.reservedCredit
      ? "none"
      : refunded
        ? "refunded"
        : "refund_pending",
    ...(input.reservedCredit && !refunded
      ? {
          message:
            "Generation failed. Credit restoration pending manual review.",
          refundReference: input.reservedCredit.reservationId,
        }
      : {}),
    ...(input.rateReserved
      ? { quotaRestoration: quotaReleased ? "released" : "pending_review" }
      : {}),
  };
}

export async function generateYcApplication(
  input: {
    caller: AuthenticatedExtensionUser;
    request: YcApplicationRequest;
    corsHeaders: Record<string, string>;
    applicationBaseUrl: string;
    logger?: SafeLogger;
    timing?: GenerationTiming;
  },
  dependencies: GenerateYcApplicationDependencies = defaultDependencies,
) {
  const operationLog = input.logger ?? log;
  const timing = input.timing;
  const isBatch = "questions" in input.request;
  const questions =
    "questions" in input.request
      ? input.request.questions
      : [input.request.question];
  timing?.config({
    ...YC_GENERATION_SETTINGS,
    maxOutputUnits: getApplicationOutputBudget(
      isBatch ? questions.length : undefined,
    ),
    ...(!dependencies.billingEnabled ? { billingMode: "disabled" } : {}),
  });
  timing?.metrics({
    itemCount: questions.length,
    targetChars: questions.reduce((sum, question) => sum + question.length, 0),
    contextChars: input.request.jd.length,
  });
  const firstQuestion = questions[0];
  if (firstQuestion === undefined)
    throw new Error("Validated question required");
  let rateReserved = false;
  let reservedCredit:
    { userId: string; reservationId: string; amount: number } | undefined;
  let modelRequested = false;

  try {
    timing?.enter("groundingLoad");
    const completeGrounding = startTimedStage(
      operationLog,
      "yc.grounding_load",
      { userId: input.caller.userId },
    );
    let context: YcGroundingContext;
    try {
      context = await dependencies.prepareGrounding({
        caller: {
          userId: input.caller.userId,
          accessToken: input.caller.accessToken,
        },
        question: firstQuestion,
        ...(isBatch ? { questions } : {}),
        jobDescription: input.request.jd,
        ...(timing ? { timing } : {}),
        logger: operationLog,
      });
    } catch (error) {
      completeGrounding("failure", { errorCode: "YC_GROUNDING_UNAVAILABLE" });
      throw error;
    }
    completeGrounding("success", { ready: context.readiness.ready });
    timing?.metrics({
      sourceChars: context.sources.reduce(
        (sum, source) => sum + source.content.length,
        0,
      ),
      sourceCount: context.sources.length,
    });

    if (!context.readiness.ready) {
      const response = ycApplicationReadinessFailureSchema.parse({
        success: false,
        error: "Candidate profile incomplete",
        code: "GROUNDING_PROFILE_INCOMPLETE",
        message:
          "Add the missing candidate information before generating this answer.",
        missingFields: context.readiness.missingFields,
        recommendedFields: context.readiness.recommendedFields,
        applicationProfileUrl: profileUrl(input.applicationBaseUrl),
        billing: "none",
      });
      return NextResponse.json(response, {
        status: 422,
        headers: input.corsHeaders,
      });
    }

    timing?.enter("rateLimit");
    const completeRateLimit = startTimedStage(
      operationLog,
      "yc.rate_limit_reserve",
      { userId: input.caller.userId },
    );
    let rate: RateLimitResult;
    try {
      rate = await dependencies.checkRateLimit(input.caller.userId);
    } catch (error) {
      completeRateLimit("failure", { errorCode: "RATE_LIMIT_RPC_FAILED" });
      throw error;
    }
    if (!rate.allowed) {
      completeRateLimit("failure", {
        errorCode: "DAILY_LIMIT_REACHED",
        status: 429,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Daily limit reached",
          code: "DAILY_LIMIT_REACHED",
          message: "You have reached today's generation limit.",
          resetTime: rate.resetTime,
          billing: "none",
        },
        {
          status: 429,
          headers: {
            ...input.corsHeaders,
            ...rateLimitHeaders(rate, dependencies),
          },
        },
      );
    }
    completeRateLimit("success", { remainingRequests: rate.remainingRequests });
    rateReserved = true;

    let billingMode: "credits" | "unlimited_developer" = "unlimited_developer";
    let creditCost = 0;
    let creditsRemaining: number | null = null;

    if (
      dependencies.billingEnabled &&
      !dependencies.isUnlimitedUser(input.caller.email)
    ) {
      timing?.config({ billingMode: "metered" });
      timing?.enter("billing");
      await dependencies.grantTrialCredits(input.caller.userId);
      const reservation = await dependencies.reserveCredits(
        input.caller.userId,
      );
      creditCost = reservation.cost;
      creditsRemaining = reservation.balanceAfter;
      billingMode = "credits";

      if (!reservation.allowed || !reservation.reservationId) {
        timing?.enter("refund");
        rateReserved = false;
        await dependencies.releaseRateLimit(input.caller.userId, operationLog);
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            message:
              "You are out of credits. Buy more credits in the Aletheia dashboard.",
            billingMode,
            creditCost,
            creditsRemaining,
          },
          {
            status: 402,
            headers: {
              ...input.corsHeaders,
              ...rateLimitHeaders(rate, dependencies),
            },
          },
        );
      }

      reservedCredit = {
        userId: input.caller.userId,
        reservationId: reservation.reservationId,
        amount: reservation.cost,
      };
    }

    if (dependencies.billingEnabled && billingMode === "unlimited_developer")
      timing?.config({ billingMode: "unlimited" });
    timing?.enter("inputBuild");
    const prompt = buildYcApplicationPrompt(context);
    timing?.metrics({
      inputChars: prompt.systemPrompt.length + prompt.userPrompt.length,
    });
    timing?.enter("model");
    const startedAt = dependencies.now();
    modelRequested = true;
    const message = await dependencies.createMessage({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      ...(isBatch ? { questionCount: questions.length } : {}),
      logger: operationLog,
    });
    const processingTime = dependencies.now() - startedAt;
    timing?.enter("postProcessing");
    timing?.metrics({
      inputUnits: message.usage.input_tokens,
      outputUnits: message.usage.output_tokens,
    });
    timing?.config({ stopReason: message.stop_reason ?? "unknown" });
    const cacheUsage = message.usage as typeof message.usage & {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    timing?.metrics({
      ...(cacheUsage.cache_read_input_tokens !== undefined
        ? { cacheReadUnits: cacheUsage.cache_read_input_tokens }
        : {}),
      ...(cacheUsage.cache_creation_input_tokens !== undefined
        ? { cacheWriteUnits: cacheUsage.cache_creation_input_tokens }
        : {}),
    });
    if (message.stop_reason === "max_tokens")
      throw new YcApplicationStructuredOutputError();
    const parsedAnswers = isBatch
      ? getApplicationBatchToolInput(message)
      : [{ questionId: "q1", ...dependencies.parseMessage(message) }];
    const byId = new Map(
      parsedAnswers.map((answer) => [answer.questionId, answer]),
    );
    if (
      parsedAnswers.length !== questions.length ||
      byId.size !== questions.length ||
      questions.some((_, index) => !byId.has(`q${index + 1}`))
    ) {
      throw new YcApplicationStructuredOutputError();
    }
    timing?.metrics({
      claimCount: parsedAnswers.reduce(
        (sum, answer) => sum + answer.claims.length,
        0,
      ),
      ledgerChars: parsedAnswers.reduce(
        (sum, answer) =>
          sum + answer.claims.reduce((n, claim) => n + claim.text.length, 0),
        0,
      ),
    });
    const validatedAnswers = [];
    for (const [index, question] of questions.entries()) {
      const questionId = `q${index + 1}`;
      const parsed = byId.get(questionId);
      if (!parsed) throw new YcApplicationStructuredOutputError();
      const sanitized = await dependencies.sanitizeOutput({
        body: parsed.body,
        claims: parsed.claims,
      });
      const selection = context.questions?.find(
        (entry) => entry.questionId === questionId,
      );
      const answerContext = selection
        ? {
            ...context,
            question: selection.question,
            sources: context.sources.filter((source) =>
              selection.sourceIds.includes(source.id),
            ),
          }
        : context;
      const validated = validateYcApplicationOutput({
        context: answerContext,
        output: sanitized.output,
      });
      validatedAnswers.push({ questionId, question, ...validated });
    }
    const answers = validatedAnswers.map((answer) => ({
      questionId: answer.questionId,
      question: answer.question,
      body: answer.body,
      word_count: answer.wordCount,
      character_count: answer.characterCount,
    }));
    const body = formatApplicationAnswers(answers);
    const claims = validatedAnswers.flatMap((answer) => answer.claims);
    const generationId = dependencies.randomUuid();
    const selectedSourceIds = [
      ...new Set(claims.flatMap((claim) => claim.sourceIds)),
    ];

    const result = ycApplicationGenerationResultSchema.parse({
      response: {
        success: true,
        category: "yc_application",
        body,
        ...(isBatch ? { answers } : {}),
        word_count: body.trim().split(/\s+/u).length,
        character_count: body.length,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
        },
        processingTime,
        evalMetadata: {
          generationId,
          promptVersion: YC_APPLICATION_PROMPT_VERSION,
          model: dependencies.model,
          category: "yc_application",
          generationTimeMs: processingTime,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          profileFieldCount: context.metadata.profileFieldCount,
          confirmedEvidenceCount: context.metadata.confirmedEvidenceCount,
          resumeSource: context.metadata.resumeSource,
          injectionTriggered: prompt.injectionScan.triggered,
          groundingValidationPassed: true,
        },
        billingMode,
        creditCost,
        creditsRemaining,
      },
      provenance: {
        generationId,
        selectedSourceIds,
        claims,
        excludedClaimCount: context.excludedClaims.length,
      },
    });

    timing?.metrics({ resultChars: body.length });
    return NextResponse.json(result.response, {
      headers: {
        ...input.corsHeaders,
        ...rateLimitHeaders(rate, dependencies),
      },
    });
  } catch (error) {
    const outputInvalid =
      error instanceof YcApplicationOutputValidationError ||
      error instanceof YcApplicationOutputSanitizationError ||
      error instanceof YcApplicationStructuredOutputError ||
      (modelRequested && error instanceof z.ZodError);
    const timeout = isAnthropicTimeoutError(error);
    timing?.failure(
      outputInvalid
        ? "OUTPUT_VALIDATION_FAILED"
        : timeout
          ? "MODEL_TIMEOUT"
          : isAnthropicAbortError(error)
            ? "MODEL_ABORTED"
            : modelRequested
              ? "MODEL_REQUEST_FAILED"
              : "GROUNDING_CONTEXT_UNAVAILABLE",
    );
    const reason = outputInvalid
      ? "yc_output_invalid"
      : timeout
        ? "model_timeout"
        : "model_upstream_error";
    timing?.enter("refund");
    const compensation = await releaseReservations({
      dependencies,
      caller: input.caller,
      reservedCredit,
      rateReserved,
      reason,
      logger: operationLog,
    });

    if (outputInvalid) {
      return NextResponse.json(
        {
          success: false,
          error: "Generated answer could not be safely validated.",
          code: "YC_OUTPUT_INVALID",
          ...compensation,
        },
        { status: 502, headers: input.corsHeaders },
      );
    }
    if (timeout) {
      return NextResponse.json(
        {
          success: false,
          error: "AI generation timed out. Please try again.",
          code: "MODEL_TIMEOUT",
          ...compensation,
        },
        { status: 504, headers: input.corsHeaders },
      );
    }

    const status = getAnthropicApiErrorStatus(error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate application answers.",
        ...compensation,
        code:
          status === null && !modelRequested
            ? "GROUNDING_CONTEXT_UNAVAILABLE"
            : "MODEL_UPSTREAM_ERROR",
      },
      {
        status: status === null && !modelRequested ? 500 : 502,
        headers: input.corsHeaders,
      },
    );
  }
}
