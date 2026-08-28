import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ycApplicationGenerationResultSchema,
  ycApplicationReadinessFailureSchema,
  type YcApplicationRequest,
} from "@/app/api/extension/generate/schema";
import { createLogger } from "@/lib/logger";
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
} from "@/modules/outreach/infrastructure/anthropic.repository";
import {
  checkGenerationRateLimit,
  getDailyLimit,
  getSupabaseService,
  refundCreditReservation,
  releaseRateLimitReservation,
} from "@/modules/outreach/infrastructure/extension-generate.repository";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import {
  createYcApplicationDraft,
  getYcApplicationToolInput,
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
    jobDescription: string;
  }) => Promise<YcGroundingContext>;
  checkRateLimit: (_userId: string) => Promise<RateLimitResult>;
  getDailyLimit: () => number;
  billingEnabled: boolean;
  isUnlimitedUser: (_email: string | null | undefined) => boolean;
  grantTrialCredits: (
    _userId: string,
  ) => Promise<{ granted: boolean; balance: number }>;
  reserveCredits: (_userId: string) => Promise<CreditReservation>;
  releaseRateLimit: (_userId: string) => Promise<unknown>;
  refundCredits: (
    _credit: { userId: string; reservationId: string; amount: number },
    _reason: string,
  ) => Promise<void>;
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
}) {
  const cleanup: Promise<unknown>[] = [];
  if (input.reservedCredit) {
    cleanup.push(
      input.dependencies.refundCredits(input.reservedCredit, input.reason),
    );
  }
  if (input.rateReserved) {
    cleanup.push(input.dependencies.releaseRateLimit(input.caller.userId));
  }
  await Promise.allSettled(cleanup);
}

export async function generateYcApplication(
  input: {
    caller: AuthenticatedExtensionUser;
    request: YcApplicationRequest;
    corsHeaders: Record<string, string>;
    applicationBaseUrl: string;
  },
  dependencies: GenerateYcApplicationDependencies = defaultDependencies,
) {
  let rateReserved = false;
  let reservedCredit:
    { userId: string; reservationId: string; amount: number } | undefined;
  let modelRequested = false;

  try {
    const context = await dependencies.prepareGrounding({
      caller: {
        userId: input.caller.userId,
        accessToken: input.caller.accessToken,
      },
      question: input.request.question,
      jobDescription: input.request.jd,
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

    const rate = await dependencies.checkRateLimit(input.caller.userId);
    if (!rate.allowed) {
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
    rateReserved = true;

    let billingMode: "credits" | "unlimited_developer" = "unlimited_developer";
    let creditCost = 0;
    let creditsRemaining: number | null = null;

    if (
      dependencies.billingEnabled &&
      !dependencies.isUnlimitedUser(input.caller.email)
    ) {
      await dependencies.grantTrialCredits(input.caller.userId);
      const reservation = await dependencies.reserveCredits(
        input.caller.userId,
      );
      creditCost = reservation.cost;
      creditsRemaining = reservation.balanceAfter;
      billingMode = "credits";

      if (!reservation.allowed || !reservation.reservationId) {
        await dependencies.releaseRateLimit(input.caller.userId);
        rateReserved = false;
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

    const prompt = buildYcApplicationPrompt(context);
    const startedAt = dependencies.now();
    modelRequested = true;
    const message = await dependencies.createMessage({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
    });
    const processingTime = dependencies.now() - startedAt;
    const parsed = dependencies.parseMessage(message);
    const sanitized = await dependencies.sanitizeOutput(parsed);
    if (sanitized.metadata.fingerprintPatternCount > 0) {
      log.info(
        {
          fingerprintPatternCount: sanitized.metadata.fingerprintPatternCount,
          fingerprintPatterns: sanitized.metadata.fingerprintPatterns,
        },
        "Application answer AI fingerprints sanitized",
      );
    }
    const validated = validateYcApplicationOutput({
      context,
      output: sanitized.output,
    });
    const generationId = dependencies.randomUuid();
    const selectedSourceIds = [
      ...new Set(validated.claims.flatMap((claim) => claim.sourceIds)),
    ];

    const result = ycApplicationGenerationResultSchema.parse({
      response: {
        success: true,
        category: "yc_application",
        body: validated.body,
        word_count: validated.wordCount,
        character_count: validated.characterCount,
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
        claims: validated.claims,
        excludedClaimCount: context.excludedClaims.length,
      },
    });

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
    const reason = outputInvalid
      ? "yc_output_invalid"
      : timeout
        ? "model_timeout"
        : "model_upstream_error";
    await releaseReservations({
      dependencies,
      caller: input.caller,
      reservedCredit,
      rateReserved,
      reason,
    });

    if (outputInvalid) {
      return NextResponse.json(
        {
          success: false,
          error: "Generated answer could not be safely validated.",
          code: "YC_OUTPUT_INVALID",
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
        },
        { status: 504, headers: input.corsHeaders },
      );
    }

    const status = getAnthropicApiErrorStatus(error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate a YC application answer.",
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
