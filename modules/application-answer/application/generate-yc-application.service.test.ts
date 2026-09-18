import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import { YcApplicationStructuredOutputError } from "../infrastructure/anthropic-yc.repository";
import {
  generateYcApplication,
  type GenerateYcApplicationDependencies,
} from "./generate-yc-application.service";
import { YcApplicationOutputSanitizationError } from "./sanitize-yc-application-output";
import { createGenerationTiming } from "@/lib/generation-timing";
import { createLogger } from "@/lib/logger";

describe("ALE-38 application timings", () => {
  it.each([
    [new Anthropic.APIConnectionTimeoutError(), "MODEL_TIMEOUT", 504],
    [new Anthropic.APIUserAbortError(), "MODEL_ABORTED", 502],
    [new Error("PRIVATE"), "MODEL_REQUEST_FAILED", 502],
  ])(
    "records a safe model failure cause while preserving responses and refunds: %s",
    async (error, code, status) => {
      const timing = createGenerationTiming();
      const logger = createLogger("test-generation");
      const deps = dependencies({
        createMessage: vi.fn().mockRejectedValue(error),
      });
      const response = await generateYcApplication(
        {
          caller,
          request,
          corsHeaders: {},
          applicationBaseUrl: "https://aletheia.live",
          timing,
          logger,
        },
        deps,
      );
      expect(response.status).toBe(status);
      expect(timing.finish(response.status).errorCode).toBe(code);
      expect(deps.refundCredits).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 4 }),
        expect.any(String),
        logger,
      );
      expect(deps.releaseRateLimit).toHaveBeenCalledWith(caller.userId, logger);
      expect(JSON.stringify(timing.finish(response.status))).not.toContain(
        "PRIVATE",
      );
    },
  );
  it("keeps model time separate from billing and postprocessing", async () => {
    let time = 0;
    const timing = createGenerationTiming(() => time);
    const deps = dependencies();
    deps.grantTrialCredits = vi.fn(async () => {
      time += 11;
      return { granted: false, balance: 40 };
    });
    deps.createMessage = vi.fn(async () => {
      time += 125;
      return {
        id: "test-message",
        type: "message" as const,
        role: "assistant" as const,
        model: "claude-test-model",
        stop_reason: "tool_use" as const,
        stop_sequence: null,
        content: [],
        usage: { input_tokens: 120, output_tokens: 80 },
      };
    });
    deps.sanitizeOutput = vi.fn(async (output) => {
      time += 7;
      return {
        output,
        metadata: { fingerprintPatternCount: 0, fingerprintPatterns: [] },
      };
    });
    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
        timing,
      },
      deps,
    );
    const summary = timing.finish(response.status);
    expect(response.status).toBe(200);
    expect(summary.stages).toMatchObject({
      billing: 11,
      model: 125,
      postProcessing: 7,
      refund: null,
    });
    expect(summary.durationMs).toBe(143);
    expect(summary.config).toMatchObject({
      temperature: 0.3,
      maxOutputUnits: 1000,
      billingMode: "metered",
      stopReason: "tool_use",
    });
    expect(summary.metrics).toMatchObject({
      inputUnits: 120,
      outputUnits: 80,
      sourceCount: 1,
      claimCount: expect.any(Number),
      ledgerChars: expect.any(Number),
      resultChars: answer.length,
    });
    expect((await response.json()).processingTime).toBe(125);
    expect(JSON.stringify(summary)).not.toContain(answer);
  });

  it("includes failed model time and refunds without logging upstream errors", async () => {
    let time = 0;
    const timing = createGenerationTiming(() => time);
    const deps = dependencies({
      createMessage: vi.fn(async () => {
        time += 30000;
        throw new Error("PRIVATE upstream body");
      }),
      refundCredits: vi.fn(async () => {
        time += 4;
        return true;
      }),
    });
    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
        timing,
      },
      deps,
    );
    const summary = timing.finish(response.status);
    expect(response.status).toBe(502);
    expect(summary.stages).toMatchObject({
      model: 30000,
      refund: 4,
      postProcessing: null,
    });
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(summary)).not.toContain("PRIVATE");
  });
});

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
    releaseRateLimit: vi.fn().mockResolvedValue(true),
    refundCredits: vi.fn().mockResolvedValue(true),
    recordRefundFailure: vi.fn().mockResolvedValue(true),
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
    const timing = createGenerationTiming();
    const deps = dependencies({
      prepareGrounding: vi.fn().mockResolvedValue(grounding(false)),
    });

    const response = await generateYcApplication(
      {
        timing,
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://www.aletheia.live",
      },
      deps,
    );

    expect(response.status).toBe(422);
    expect(timing.finish(422).config.billingMode).toBeUndefined();
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
        promptVersion: "yc-1.2.0",
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
    const timing = createGenerationTiming();
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
        timing,
      },
      deps,
    );

    expect(response.status).toBe(502);
    expect(timing.finish(502).errorCode).toBe("OUTPUT_VALIDATION_FAILED");
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "YC_OUTPUT_INVALID",
    });
    expect(deps.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4 }),
      "yc_output_invalid",
      expect.objectContaining({ info: expect.any(Function) }),
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(
      caller.userId,
      expect.objectContaining({ info: expect.any(Function) }),
    );
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
      expect.objectContaining({ info: expect.any(Function) }),
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(
      caller.userId,
      expect.objectContaining({ info: expect.any(Function) }),
    );
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
      expect.objectContaining({ info: expect.any(Function) }),
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(
      caller.userId,
      expect.objectContaining({ info: expect.any(Function) }),
    );
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
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(
      caller.userId,
      expect.objectContaining({ info: expect.any(Function) }),
    );
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
      expect.objectContaining({ info: expect.any(Function) }),
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(
      caller.userId,
      expect.objectContaining({ info: expect.any(Function) }),
    );
  });
});

describe("ALE-37 batch orchestration", () => {
  const questions = [
    "Why are you a strong candidate?",
    "Describe your production experience?",
  ];
  const run = (deps: GenerateYcApplicationDependencies) =>
    generateYcApplication(
      {
        caller,
        request: { category: "yc_application", jd: request.jd, questions },
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
      },
      deps,
    );
  const batch = (ids = ["q2", "q1"]) => ({
    answers: ids.map((questionId) => ({
      questionId,
      body: answer,
      claims: [
        {
          text: answer,
          source_ids: ["evidence:11111111-1111-4111-8111-111111111111"],
        },
      ],
    })),
  });
  function batchDeps(output = batch()) {
    return dependencies({
      createMessage: vi.fn().mockResolvedValue({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            name: "return_application_answers",
            input: output,
          },
        ],
        usage: { input_tokens: 120, output_tokens: 800 },
      }),
    });
  }
  it("orders exact IDs, validates independently and charges one batch", async () => {
    const deps = batchDeps();
    const response = await run(deps);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(
      result.answers.map((entry: { questionId: string }) => entry.questionId),
    ).toEqual(["q1", "q2"]);
    expect(
      result.answers.map((entry: { question: string }) => entry.question),
    ).toEqual(questions);
    expect(result.body).toBe(
      `**${questions[0]}**\n${answer}\n\n**${questions[1]}**\n${answer}`,
    );
    expect(deps.sanitizeOutput).toHaveBeenCalledTimes(2);
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.reserveCredits).toHaveBeenCalledTimes(1);
    expect(deps.checkRateLimit).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('"claims"');
  });
  it("delivers five answers in request order with one reservation and provider call", async () => {
    const fiveQuestions = Array.from(
      { length: 5 },
      (_, index) =>
        `Describe your relevant experience for question ${index + 1}?`,
    );
    const deps = batchDeps(batch(["q5", "q3", "q1", "q4", "q2"]));
    const response = await generateYcApplication(
      {
        caller,
        request: {
          category: "yc_application",
          jd: request.jd,
          questions: fiveQuestions,
        },
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
      },
      deps,
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(
      result.answers.map((entry: { question: string }) => entry.question),
    ).toEqual(fiveQuestions);
    expect(deps.sanitizeOutput).toHaveBeenCalledTimes(5);
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.reserveCredits).toHaveBeenCalledTimes(1);
    expect(deps.checkRateLimit).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).not.toHaveBeenCalled();
  });
  it.each([["q1"], ["q1", "q1"], ["q1", "q3"], ["q1", "q2", "q3"]])(
    "rejects incomplete or invalid IDs %j",
    async (...ids) => {
      const deps = batchDeps(batch(ids));
      const response = await run(deps);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: "YC_OUTPUT_INVALID",
        billing: "refunded",
      });
      expect(deps.refundCredits).toHaveBeenCalledTimes(1);
      expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects a batch if just one answer has an unsupported metric", async () => {
    const output = batch();
    if (!output.answers[1]) throw new Error("Missing fixture");
    output.answers[1].body += " Increased revenue by 987%.";
    const deps = batchDeps(output);
    const response = await run(deps);
    expect(response.status).toBe(502);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
  });
  it("rejects truncation even when a parser could recover partial data", async () => {
    const deps = batchDeps();
    deps.createMessage = vi.fn().mockResolvedValue({
      stop_reason: "max_tokens",
      content: [],
      usage: { input_tokens: 1, output_tokens: 3000 },
    });
    expect((await run(deps)).status).toBe(502);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
  });
  it("reports pending compensation and records manual reconciliation without retrying quota", async () => {
    const record = vi.fn().mockResolvedValue(true);
    const deps = {
      ...batchDeps(batch(["q1"])),
      refundCredits: vi.fn().mockRejectedValue(new Error("PRIVATE")),
      recordRefundFailure: record,
    };
    const response = await run(deps);
    expect(await response.json()).toMatchObject({
      code: "YC_OUTPUT_INVALID",
      billing: "refund_pending",
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "22222222-2222-4222-8222-222222222222",
        amount: 4,
      }),
      expect.any(String),
      expect.anything(),
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
  });
});
