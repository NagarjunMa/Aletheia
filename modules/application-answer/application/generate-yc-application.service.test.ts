import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import { YcApplicationStructuredOutputError } from "../infrastructure/anthropic-yc.repository";
import {
  generateYcApplication,
  type GenerateYcApplicationDependencies,
} from "./generate-yc-application.service";
import { YcApplicationOutputSanitizationError } from "./sanitize-yc-application-output";

const answer =
  "I build reliable TypeScript services from ambiguous requirements and carry them through production. In a recent customer workflow, I designed the architecture, shipped the service, and operated it after launch. That experience fits an early-stage team because I move quickly, stay close to users, and take responsibility for outcomes across the full delivery cycle.";

function grounding(ready = true): YcGroundingContext {
  return {
    question: "Why are you a strong candidate for this role?",
    jobDescription:
      "Join a small YC startup team to build and operate reliable TypeScript products for customers.",
    sources: ready
      ? [
          {
            id: "evidence:11111111-1111-4111-8111-111111111111",
            type: "evidence",
            label: "Production delivery",
            content: answer,
            priority: 1,
          },
        ]
      : [],
    excludedClaims: [],
    readiness: {
      ready,
      missingFields: ready
        ? []
        : ["current_role_or_resume", "confirmed_evidence"],
      recommendedFields: ready ? [] : ["technical_project_evidence"],
    },
    metadata: {
      profileFieldCount: ready ? 2 : 0,
      confirmedEvidenceCount: ready ? 1 : 0,
      resumeSource: ready ? "user_resumes" : "none",
    },
  };
}

function dependencies(
  overrides: Partial<GenerateYcApplicationDependencies> = {},
): GenerateYcApplicationDependencies {
  return {
    prepareGrounding: vi.fn().mockResolvedValue(grounding()),
    checkRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remainingRequests: 29,
      resetTime: 2_000_000_000_000,
    }),
    getDailyLimit: vi.fn().mockReturnValue(30),
    billingEnabled: true,
    isUnlimitedUser: vi.fn().mockReturnValue(false),
    grantTrialCredits: vi
      .fn()
      .mockResolvedValue({ granted: false, balance: 40 }),
    reserveCredits: vi.fn().mockResolvedValue({
      allowed: true,
      reservationId: "22222222-2222-4222-8222-222222222222",
      balanceAfter: 36,
      cost: 4,
    }),
    releaseRateLimit: vi.fn().mockResolvedValue(null),
    refundCredits: vi.fn().mockResolvedValue(undefined),
    createMessage: vi.fn().mockResolvedValue({
      content: [],
      usage: { input_tokens: 120, output_tokens: 80 },
    }),
    parseMessage: vi.fn().mockReturnValue({
      body: answer,
      claims: [
        {
          text: answer,
          sourceIds: ["evidence:11111111-1111-4111-8111-111111111111"],
        },
      ],
    }),
    sanitizeOutput: vi.fn().mockImplementation(async (output) => ({
      output,
      metadata: { fingerprintPatternCount: 0, fingerprintPatterns: [] },
    })),
    now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_125),
    randomUuid: vi.fn().mockReturnValue("33333333-3333-4333-8333-333333333333"),
    model: "claude-test-model",
    ...overrides,
  };
}

const request = {
  category: "yc_application" as const,
  jd: "Join a small YC startup team to build and operate reliable TypeScript products for customers.",
  question: "Why are you a strong candidate for this role?",
};

const caller = {
  userId: "44444444-4444-4444-8444-444444444444",
  email: "candidate@example.com",
  accessToken: "verified-access-token",
};

describe("generateYcApplication", () => {
  it("returns a privacy-safe 422 before rate limiting, billing, or model work", async () => {
    const deps = dependencies({
      prepareGrounding: vi.fn().mockResolvedValue(grounding(false)),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Candidate profile incomplete",
      code: "GROUNDING_PROFILE_INCOMPLETE",
      message:
        "Add the missing candidate information before generating this answer.",
      missingFields: ["current_role_or_resume", "confirmed_evidence"],
      recommendedFields: ["technical_project_evidence"],
      applicationProfileUrl: "https://www.aletheia.live/profile/application",
      billing: "none",
    });
    expect(deps.checkRateLimit).not.toHaveBeenCalled();
    expect(deps.grantTrialCredits).not.toHaveBeenCalled();
    expect(deps.reserveCredits).not.toHaveBeenCalled();
    expect(deps.createMessage).not.toHaveBeenCalled();
  });

  it("reserves four credits only after grounding and returns validated provenance metadata", async () => {
    const deps = dependencies();

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      category: "yc_application",
      body: answer,
      word_count: 54,
      character_count: answer.length,
      usage: { input_tokens: 120, output_tokens: 80 },
      processingTime: 125,
      billingMode: "credits",
      creditCost: 4,
      creditsRemaining: 36,
      evalMetadata: {
        generationId: "33333333-3333-4333-8333-333333333333",
        promptVersion: "yc-1.1.0",
        model: "claude-test-model",
        category: "yc_application",
        profileFieldCount: 2,
        confirmedEvidenceCount: 1,
        resumeSource: "user_resumes",
        groundingValidationPassed: true,
      },
    });
    expect(deps.prepareGrounding).toHaveBeenCalledBefore(
      deps.checkRateLimit as ReturnType<typeof vi.fn>,
    );
    expect(deps.checkRateLimit).toHaveBeenCalledBefore(
      deps.reserveCredits as ReturnType<typeof vi.fn>,
    );
    expect(deps.reserveCredits).toHaveBeenCalledBefore(
      deps.createMessage as ReturnType<typeof vi.fn>,
    );
    expect(deps.refundCredits).not.toHaveBeenCalled();
    expect(deps.releaseRateLimit).not.toHaveBeenCalled();
    expect(deps.sanitizeOutput).toHaveBeenCalledWith({
      body: answer,
      claims: [
        {
          text: answer,
          sourceIds: ["evidence:11111111-1111-4111-8111-111111111111"],
        },
      ],
    });
  });

  it("refunds both reservations when the model output fails validation", async () => {
    const deps = dependencies({
      parseMessage: vi.fn().mockReturnValue({
        body: "Too short.",
        claims: [
          {
            text: "Too short.",
            sourceIds: ["evidence:11111111-1111-4111-8111-111111111111"],
          },
        ],
      }),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "YC_OUTPUT_INVALID",
    });
    expect(deps.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4 }),
      "yc_output_invalid",
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(caller.userId);
  });

  it("treats malformed structured model output as refundable invalid output", async () => {
    const deps = dependencies({
      parseMessage: vi.fn().mockImplementation(() => {
        throw new YcApplicationStructuredOutputError();
      }),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "YC_OUTPUT_INVALID",
    });
    expect(deps.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4 }),
      "yc_output_invalid",
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(caller.userId);
  });

  it("refunds the batch when claim-safe sanitation rejects output", async () => {
    const deps = dependencies({
      sanitizeOutput: vi
        .fn()
        .mockRejectedValue(
          new YcApplicationOutputSanitizationError(
            "Sanitized claim text must appear verbatim in the answer",
          ),
        ),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "YC_OUTPUT_INVALID",
    });
    expect(deps.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4 }),
      "yc_output_invalid",
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(caller.userId);
  });

  it("does not call the model or billing when the daily limit is reached", async () => {
    const deps = dependencies({
      checkRateLimit: vi.fn().mockResolvedValue({
        allowed: false,
        remainingRequests: 0,
        resetTime: 2_000_000_000_000,
      }),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(429);
    expect(deps.reserveCredits).not.toHaveBeenCalled();
    expect(deps.createMessage).not.toHaveBeenCalled();
  });

  it("releases the daily slot when four credits cannot be reserved", async () => {
    const deps = dependencies({
      reserveCredits: vi.fn().mockResolvedValue({
        allowed: false,
        reservationId: null,
        balanceAfter: 2,
        cost: 4,
      }),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      code: "INSUFFICIENT_CREDITS",
      creditCost: 4,
      creditsRemaining: 2,
    });
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(caller.userId);
    expect(deps.refundCredits).not.toHaveBeenCalled();
    expect(deps.createMessage).not.toHaveBeenCalled();
  });

  it("returns a zero-cost response for unlimited users without touching the wallet", async () => {
    const deps = dependencies({
      isUnlimitedUser: vi.fn().mockReturnValue(true),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    await expect(response.json()).resolves.toMatchObject({
      billingMode: "unlimited_developer",
      creditCost: 0,
      creditsRemaining: null,
    });
    expect(deps.grantTrialCredits).not.toHaveBeenCalled();
    expect(deps.reserveCredits).not.toHaveBeenCalled();
  });

  it("returns 504 and refunds both reservations on a model timeout", async () => {
    const deps = dependencies({
      createMessage: vi
        .fn()
        .mockRejectedValue(new Anthropic.APIConnectionTimeoutError()),
    });

    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      code: "MODEL_TIMEOUT",
    });
    expect(deps.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4 }),
      "model_timeout",
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(caller.userId);
  });
});
