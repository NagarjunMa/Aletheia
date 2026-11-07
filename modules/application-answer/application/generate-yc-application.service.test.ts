import { allowedClaimTexts } from "@/modules/grounding/domain/atomic-claim";
import { describe, expect, it, vi } from "vitest";
import { SelectedEvidenceUnavailableError } from "@/modules/candidate-context/application/selected-evidence";
import Anthropic from "@anthropic-ai/sdk";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import {
  getYcApplicationToolInput,
  YcApplicationStructuredOutputError,
} from "../infrastructure/anthropic-yc.repository";
import {
  generateYcApplication,
  type GenerateYcApplicationDependencies,
} from "./generate-yc-application.service";
import {
  sanitizeYcApplicationOutput,
  YcApplicationOutputSanitizationError,
} from "./sanitize-yc-application-output";
import { createGenerationTiming } from "@/lib/generation-timing";
import { createLogger } from "@/lib/logger";
import { sanitizeLogFields } from "@/lib/logging-core";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import { buildYcGroundingContext } from "./build-yc-grounding-context";
import { startGenerationAttempt } from "@/modules/outreach/infrastructure/extension-generate.repository";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";

it("rejects unusable bounded evidence before any quota, credit or model request", async () => {
  const context = buildYcGroundingContext({
    question: "Describe your work?",
    jobDescription: "",
    candidate: {
      identity: { fullName: "", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({}),
      resume: { text: "background ".repeat(100), source: "user_resumes" },
      confirmedEvidence: [
        {
          id: "oversized",
          kind: "achievement",
          title: "Work",
          context: "",
          actions: "experience ".repeat(100),
          outcome: "",
          metrics: [],
          skills: [],
          links: [],
          confirmed: true,
          sortOrder: 0,
        },
      ],
    },
  });
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
  });
  const response = await generateYcApplication(
    {
      caller,
      request,
      corsHeaders: {},
      applicationBaseUrl: "https://aletheia.live",
    },
    deps,
  );
  expect(response.status).toBe(422);
  expect(deps.checkRateLimit).not.toHaveBeenCalled();
  expect(deps.reserveCredits).not.toHaveBeenCalled();
  expect(deps.createMessage).not.toHaveBeenCalled();
});

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
      expect(deps.releaseRateLimit).toHaveBeenCalledWith(
        caller.userId,
        expect.any(String),
        logger,
      );
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
    selectionDiagnostics: [
      {
        outcome: ready ? "matched" : "no_match",
        consideredCount: 1,
        matchedCount: ready ? 1 : 0,
      },
    ],
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
    atomicSources: ready
      ? [
          {
            id: "evidence:11111111-1111-4111-8111-111111111111",
            rootId: "evidence:11111111-1111-4111-8111-111111111111",
            scope: "candidate",
            kind: "action",
            content: answer,
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
      reservationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    startAttempt: vi.fn().mockResolvedValue({
      allowed: true,
      attemptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }),
    finishAttempt: vi.fn().mockResolvedValue(true),
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
          kind: "action",
          source_id: "evidence:11111111-1111-4111-8111-111111111111",
          supporting_excerpt: answer,
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

describe("ALE-56 server-owned YC admission", () => {
  it("charges an exact five-question batch eight work units before any model call", async () => {
    const deps = dependencies({
      startAttempt: vi.fn().mockResolvedValue({
        allowed: false,
        unavailable: false,
        code: "WORK_BUDGET_REACHED",
        retryTime: Date.now() + 60_000,
      }),
    });
    const response = await generateYcApplication(
      {
        caller,
        request: {
          category: "yc_application",
          jd: request.jd,
          questions: Array.from(
            { length: 5 },
            (_, index) => `Why does experience ${index + 1} fit this role?`,
          ),
        },
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
      },
      deps,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toMatch(/^\d+$/u);
    expect(deps.startAttempt).toHaveBeenCalledWith(
      caller.userId,
      expect.any(String),
      8,
      expect.any(Object),
    );
    expect(deps.createMessage).not.toHaveBeenCalled();
    expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
  });

  it("compensates a delayed real-SDK admission without calling the YC model", async () => {
    let elapsed = 0;
    const clock = vi
      .spyOn(performance, "now")
      .mockImplementation(() => elapsed);
    vi.stubGlobal("fetch", async () => {
      elapsed = 181_000;
      return Response.json([
        { allowed: true, attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      ]);
    });
    try {
      const deps = dependencies({ startAttempt: startGenerationAttempt });
      const response = await generateYcApplication(
        {
          caller,
          request,
          corsHeaders: {},
          applicationBaseUrl: "https://aletheia.live",
        },
        deps,
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBeNull();
      expect(deps.createMessage).not.toHaveBeenCalled();
      expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    } finally {
      clock.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("fails closed with 503 when attempt storage is unavailable", async () => {
    const deps = dependencies({
      startAttempt: vi
        .fn()
        .mockResolvedValue({ allowed: false, unavailable: true }),
    });
    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
      },
      deps,
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBeNull();
    expect(deps.createMessage).not.toHaveBeenCalled();
    expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
  });
});

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

  it("rejects a real zero-match context before quota, credit and provider work", async () => {
    const jd = "Quantum chemistry research studying molecular spectroscopy.";
    const context = buildYcGroundingContext({
      question: request.question,
      jobDescription: jd,
      candidate: {
        identity: { fullName: "Synthetic", linkedinUrl: "" },
        profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
        resume: { text: "", source: "none" },
        confirmedEvidence: [
          {
            id: "policy",
            kind: "technical_project",
            title: "Policy project",
            context: "",
            actions: "I built policy documentation tools.",
            outcome: "",
            metrics: [],
            skills: [],
            links: [],
            confirmed: true,
            sortOrder: 0,
          },
        ],
      },
    });
    expect(context.selectionDiagnostics?.[0]?.outcome).toBe("no_match");
    const deps = dependencies({
      prepareGrounding: vi.fn().mockResolvedValue(context),
    });
    const response = await generateYcApplication(
      {
        caller,
        request: { ...request, jd },
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
      },
      deps,
    );
    expect(response.status).toBe(422);
    expect(deps.checkRateLimit).not.toHaveBeenCalled();
    expect(deps.reserveCredits).not.toHaveBeenCalled();
    expect(deps.startAttempt).not.toHaveBeenCalled();
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
    expect(body.evalMetadata.quality).toMatchObject({
      version: 1,
      archetype: "legacy",
      groundingPassed: true,
      selectedSourceCount: expect.any(Number),
    });
    expect(JSON.stringify(body.evalMetadata)).not.toMatch(
      /source_id|supporting_excerpt|rp1\./u,
    );
    expect(JSON.stringify(body)).not.toContain("selectionDiagnostics");
    expect(JSON.stringify(body)).not.toContain("consideredCount");
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
        promptVersion: "yc-2.1.0",
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
          kind: "action",
          source_id: "evidence:11111111-1111-4111-8111-111111111111",
          supporting_excerpt: answer,
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
      expect.any(String),
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
      expect.any(String),
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
      expect.any(String),
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
      expect.any(String),
      expect.objectContaining({ info: expect.any(Function) }),
    );
    expect(deps.refundCredits).not.toHaveBeenCalled();
    expect(deps.createMessage).not.toHaveBeenCalled();
  });

  it("reports a pending daily slot when insufficient-credit release fails", async () => {
    const deps = dependencies({
      reserveCredits: vi.fn().mockResolvedValue({
        allowed: false,
        reservationId: null,
        balanceAfter: 2,
        cost: 4,
      }),
      releaseRateLimit: vi.fn().mockResolvedValue(false),
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
      quotaRestoration: "pending_review",
    });
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
      expect.any(String),
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
      claims: [
        {
          text: answer,
          kind: "action",
          source_id: "evidence:11111111-1111-4111-8111-111111111111",
          supporting_excerpt: answer,
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
  it.each([
    ["tool_schema", "tool_parse", "YC_TOOL_SCHEMA", undefined],
    ["obsolete_tool_fields", "tool_parse", "YC_TOOL_SCHEMA", undefined],
    ["ids", "batch_contract", "YC_BATCH_IDS", undefined],
    ["source", "grounding", "CLAIM_SOURCE", 1],
    ["coverage", "grounding", "CLAIM_COVERAGE", 1],
    ["limit", "grounding", "OUTPUT_LIMIT", 1],
    ["sanitize", "sanitize", "YC_SANITIZATION_FAILED", 1],
    ["response", "response", "YC_RESPONSE_SCHEMA", undefined],
  ] as const)(
    "distinguishes %s failure without exposing private values",
    async (kind, stage, code, itemIndex) => {
      const output = batch(["q1", "q2"]);
      const deps = batchDeps(output);
      const logger = createLogger("test-yc-diagnostics");
      const warn = vi.spyOn(logger, "warn");
      if (kind === "tool_schema")
        Object.assign(output.answers[0]!.claims[0]!, {
          text: 123,
          PRIVATE_FIELD: "PRIVATE_RAW_INPUT",
        });
      if (kind === "obsolete_tool_fields")
        Object.assign(output.answers[0]!, {
          body: answer,
          word_count: answer.split(/\s+/u).length,
        });
      if (kind === "ids") output.answers[1]!.questionId = "q1";
      if (kind === "source")
        output.answers[0]!.claims[0]!.source_id = "PRIVATE_SOURCE_ID";
      if (kind === "coverage" || kind === "limit")
        deps.sanitizeOutput = vi.fn(async (input) => {
          const sanitized = await sanitizeYcApplicationOutput(input);
          sanitized.output.body =
            kind === "coverage"
              ? sanitized.output.body + " PRIVATE_UNSUPPORTED_TEXT"
              : Array(4).fill(sanitized.output.body).join(" ");
          return sanitized;
        });
      if (kind === "sanitize")
        deps.sanitizeOutput = vi
          .fn()
          .mockRejectedValue(
            new YcApplicationOutputSanitizationError(
              "PRIVATE_SANITIZATION_ERROR",
            ),
          );
      if (kind === "response") deps.randomUuid = () => "PRIVATE_GENERATION_ID";
      const result = await generateYcApplication(
        {
          caller,
          request: { category: "yc_application", jd: request.jd, questions },
          corsHeaders: {},
          applicationBaseUrl: "https://aletheia.live",
          logger,
        },
        deps,
      );
      expect(result.status).toBe(502);
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "yc.output_validation.failed",
          validationStage: stage,
          validationCode: code,
          ...(itemIndex ? { itemIndex } : {}),
        }),
        "Application output validation failed",
      );
      const diagnostics = warn.mock.calls.find(
        ([fields]) =>
          typeof fields === "object" &&
          fields?.event === "yc.output_validation.failed",
      )?.[0];
      expect(diagnostics).toBeDefined();
      expect(JSON.stringify(diagnostics)).not.toContain("PRIVATE");
      expect(JSON.stringify(diagnostics)).not.toContain(answer);
      expect(JSON.stringify(diagnostics)).not.toContain("evidence:");
      if (kind === "tool_schema")
        expect(diagnostics).toMatchObject({
          validationDetails: expect.arrayContaining([
            expect.objectContaining({
              field: "answers.item.claims.item.text",
              code: "invalid_type",
              itemIndex: 1,
            }),
          ]),
        });
      expect(
        sanitizeLogFields(diagnostics as Record<string, unknown>),
      ).toMatchObject({ validationStage: stage, validationCode: code });
      const publicResult = await result.json();
      expect(publicResult).toMatchObject({
        code: "YC_OUTPUT_INVALID",
        billing: "refunded",
        quotaRestoration: "released",
      });
      expect(publicResult).not.toHaveProperty("validationCode");
      expect(publicResult).not.toHaveProperty("validationDetails");
      expect(deps.createMessage).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).toHaveBeenCalledTimes(1);
      expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
      expect(deps.finishAttempt).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    },
  );
  it("passes a reviewed fact through five answers with real preparation, parsing, sanitation and final public projection", async () => {
    const record = {
      id: "11111111-1111-4111-8111-111111111111",
      kind: "technical_project" as const,
      title: "TypeScript production delivery",
      context: "",
      actions: answer,
      outcome: "",
      metrics: [],
      skills: ["TypeScript"],
      links: [],
      confirmed: true,
      sortOrder: 0,
    };
    const fiveQuestions = Array.from(
      { length: 5 },
      (_, i) => `Describe TypeScript production delivery experience ${i + 1}?`,
    );
    const context = buildYcGroundingContext({
      question: fiveQuestions[0]!,
      questions: fiveQuestions,
      jobDescription: request.jd,
      candidate: {
        identity: { fullName: "Synthetic", linkedinUrl: "" },
        profile: candidateProfileInputSchema.parse({
          currentRole: "Software Engineer",
        }),
        resume: { text: "", source: "none" },
        confirmedEvidence: [
          {
            ...record,
            factReview: prepareFactReview(record, [
              {
                id: "22222222-2222-4222-8222-222222222222",
                kind: "action",
                excerpt: answer,
                confirmed: true,
              },
            ]),
          },
        ],
      },
    });
    expect(context.readiness.ready).toBe(true);
    const source = context.atomicSources!.find((s) => s.scope === "candidate")!;
    const before = JSON.stringify(context);
    const output = {
      answers: fiveQuestions.map((_, i) => ({
        questionId: `q${i + 1}`,
        claims: [
          {
            text: answer,
            kind: source.kind,
            source_id: source.id,
            supporting_excerpt: source.content,
          },
        ],
      })),
    };
    const deps = batchDeps(output);
    deps.prepareGrounding = vi.fn().mockResolvedValue(context);
    deps.sanitizeOutput = vi.fn(sanitizeYcApplicationOutput);
    const result = await generateYcApplication(
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
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.answers).toHaveLength(5);
    expect(body.answers.every((a: { body: string }) => a.body === answer)).toBe(
      true,
    );
    expect(JSON.stringify(body)).not.toMatch(
      /supporting_excerpt|source_id|provenance|claims|evidence:/u,
    );
    expect(JSON.stringify(context)).toBe(before);
    expect(deps.refundCredits).not.toHaveBeenCalled();
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.startAttempt).toHaveBeenCalledWith(
      caller.userId,
      expect.any(String),
      8,
      expect.anything(),
    );
  });
  it("reports the second answer index for a late grounding failure", async () => {
    const output = batch(["q1", "q2"]);
    output.answers[1]!.claims[0]!.supporting_excerpt += " PRIVATE_QUALIFIER";
    const deps = batchDeps(output);
    const logger = createLogger("test-yc-late-failure");
    const warn = vi.spyOn(logger, "warn");
    const result = await generateYcApplication(
      {
        caller,
        request: { category: "yc_application", jd: request.jd, questions },
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
        logger,
      },
      deps,
    );
    expect(result.status).toBe(502);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        validationStage: "grounding",
        validationCode: "CLAIM_SUPPORT",
        itemIndex: 2,
      }),
      expect.any(String),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE_QUALIFIER");
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
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
  it("rejects an otherwise valid atomic source excluded from one question", async () => {
    const deps = batchDeps();
    const selected = grounding();
    selected.questions = [
      { questionId: "q1", question: questions[0]!, sourceIds: [] },
      {
        questionId: "q2",
        question: questions[1]!,
        sourceIds: selected.sources.map((source) => source.id),
      },
    ];
    deps.prepareGrounding = vi.fn().mockResolvedValue(selected);
    const result = await run(deps);
    expect(result.status).toBe(502);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    expect(await result.text()).not.toContain(answer);
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
    output.answers[1]!.claims[0]!.text += " Increased revenue by 987%.";
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

describe("ALE-53 debit capture callbacks", () => {
  it("retains original debit after failed automatic compensation", async () => {
    const onCreditReserved = vi.fn(),
      onCreditReservationPending = vi.fn();
    const deps = dependencies({
      createMessage: vi
        .fn()
        .mockRejectedValue(new Anthropic.APIConnectionTimeoutError()),
      refundCredits: vi.fn().mockResolvedValue(false),
    });
    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
        onCreditReserved,
        onCreditReservationPending,
      },
      deps,
    );
    expect(response.status).toBe(504);
    expect(onCreditReserved).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(onCreditReservationPending.mock.calls).toEqual([[true], [false]]);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
  });
  it("preserves uncertainty when reservation acknowledgement is lost", async () => {
    const onCreditReserved = vi.fn(),
      onCreditReservationPending = vi.fn();
    const deps = dependencies({
      reserveCredits: vi.fn().mockRejectedValue(new Error("Connection lost")),
    });
    await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://aletheia.live",
        onCreditReserved,
        onCreditReservationPending,
      },
      deps,
    );
    expect(onCreditReserved).not.toHaveBeenCalled();
    expect(onCreditReservationPending.mock.calls).toEqual([[true]]);
    expect(deps.refundCredits).not.toHaveBeenCalled();
  });
});

describe("ALE-47 actual YC finalization", () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    "keeps facts or refunds final overlength output (batch: %s, oversized: %s)",
    async (isBatch, oversized) => {
      const fact = `${answer} I used robust AI-first Node.js v20.2 workflows — with --dry-run.`;
      const body = oversized ? Array(3).fill(fact).join(" ") : fact;
      const id = "evidence:11111111-1111-4111-8111-111111111111";
      const claim = {
        text: fact,
        kind: "action" as const,
        source_id: id,
        supporting_excerpt: fact,
        sourceIds: [id],
      };
      const ctx = grounding();
      ctx.sources[0]!.content = fact;
      ctx.atomicSources![0]!.content = fact;
      const questions = [
        "Describe your work?",
        "Describe your production experience?",
      ];
      const deps = dependencies({
        prepareGrounding: vi.fn().mockResolvedValue(ctx),
        parseMessage: vi.fn().mockReturnValue({ body, claims: [claim] }),
        sanitizeOutput: (output) =>
          sanitizeYcApplicationOutput({ ...output, body }),
        createMessage: vi.fn().mockResolvedValue({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              name: "return_application_answers",
              input: {
                answers: questions.map((_, index) => ({
                  questionId: `q${index + 1}`,
                  claims: [
                    {
                      text: fact,
                      kind: "action",
                      source_id: id,
                      supporting_excerpt: fact,
                    },
                  ],
                })),
              },
            },
          ],
          usage: { input_tokens: 120, output_tokens: 800 },
        }),
      });
      const response = await generateYcApplication(
        {
          caller,
          request: isBatch
            ? { category: "yc_application", jd: request.jd, questions }
            : request,
          corsHeaders: {},
          applicationBaseUrl: "https://aletheia.live",
        },
        deps,
      );
      if (oversized) {
        expect(response.status).toBe(502);
        expect((await response.json()).code).toBe("YC_OUTPUT_INVALID");
        expect(deps.createMessage).toHaveBeenCalledTimes(1);
        expect(deps.refundCredits).toHaveBeenCalledTimes(1);
        expect(deps.releaseRateLimit).toHaveBeenCalledWith(
          caller.userId,
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          expect.anything(),
        );
        return;
      }
      expect(response.status).toBe(200);
      const result = await response.json();
      if (isBatch) {
        expect(
          result.answers.map((entry: { body: string }) => entry.body),
        ).toEqual([fact, fact]);
        expect(result.body).toContain(`**${questions[0]}**\n${fact}`);
      } else expect(result.body).toBe(fact);
      expect(JSON.stringify(result)).not.toMatch(
        /supporting_excerpt|sourceIds|evidence:111/,
      );
      expect(deps.createMessage).toHaveBeenCalledTimes(1);
      expect(deps.reserveCredits).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).not.toHaveBeenCalled();
    },
  );
});

it.each([false, true])(
  "ALE-49 planned YC output preserves privacy and fair compensation (invalid: %s)",
  async (invalid) => {
    const deps = dependencies();
    deps.createMessage = vi.fn<
      GenerateYcApplicationDependencies["createMessage"]
    >(async (input) => {
      const o = input.plannedOptions![0]!.options[0]!;
      return {
        id: "test",
        type: "message",
        role: "assistant",
        model: "test",
        stop_reason: "tool_use",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 },
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "return_yc_application_answer",
            input: {
              option_id: o.id,
              rhetorical_plan: {
                reference: invalid
                  ? "rp1." + "0".repeat(24)
                  : o.rhetoricalPlan.reference,
                archetype: o.rhetoricalPlan.archetype,
              },
            },
          },
        ],
      };
    });
    const response = await generateYcApplication(
      {
        caller,
        request,
        corsHeaders: {},
        applicationBaseUrl: "https://example.test",
        rhetoricalPlans: true,
      },
      deps,
    );
    expect(response.status).toBe(invalid ? 502 : 200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(
      /rhetorical|source_id|supporting_excerpt|rp1\.|option_id/u,
    );
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.finishAttempt).toHaveBeenCalledTimes(1);
    expect(deps.parseMessage).not.toHaveBeenCalled();
    if (invalid) {
      expect(deps.refundCredits).toHaveBeenCalledTimes(1);
      expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    } else {
      expect(body.evalMetadata.promptVersion).toBe("yc-3.0.0");
      expect(deps.refundCredits).not.toHaveBeenCalled();
    }
  },
);
it("ALE-49 rejects insufficient complete YC evidence before quota or model admission", async () => {
  const context = grounding();
  context.atomicSources![0]!.content = "I built a prototype.";
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
  });
  const response = await generateYcApplication(
    {
      caller,
      request,
      corsHeaders: {},
      applicationBaseUrl: "https://example.test",
      rhetoricalPlans: true,
    },
    deps,
  );
  expect(response.status).toBe(422);
  expect(deps.checkRateLimit).not.toHaveBeenCalled();
  expect(deps.reserveCredits).not.toHaveBeenCalled();
  expect(deps.createMessage).not.toHaveBeenCalled();
});

describe("ALE-55 application selection", () => {
  const selected = "11111111-1111-4111-8111-111111111111";
  const second = "ae550000-2222-4222-8222-222222222222";
  const selectedRequest = { ...request, selectedEvidenceIds: [selected] };
  const selectedInput = {
    caller,
    request: selectedRequest,
    corsHeaders: {},
    applicationBaseUrl: "https://aletheia.live",
    rhetoricalPlans: false,
  };

  it("stops a stale selection before quota, credit, admission or model work", async () => {
    const deps = dependencies({
      prepareGrounding: vi
        .fn()
        .mockRejectedValue(new SelectedEvidenceUnavailableError()),
    });
    const response = await generateYcApplication(selectedInput, deps);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "EVIDENCE_SELECTION_UNAVAILABLE",
      billing: "none",
    });
    expect(deps.prepareGrounding).toHaveBeenCalledWith(
      expect.objectContaining({
        caller: { userId: caller.userId, accessToken: caller.accessToken },
        selectedEvidenceIds: [selected],
      }),
    );
    expect(deps.checkRateLimit).not.toHaveBeenCalled();
    expect(deps.reserveCredits).not.toHaveBeenCalled();
    expect(deps.startAttempt).not.toHaveBeenCalled();
    expect(deps.createMessage).not.toHaveBeenCalled();
  });

  it("proves every explicit batch answer is feasible before quota even with plans off", async () => {
    const base = grounding();
    const context: YcGroundingContext = {
      ...base,
      requiredEvidenceRoots: [`evidence:${selected}`],
      questions: [
        {
          questionId: "q1",
          question: request.question,
          sourceIds: [`evidence:${selected}`],
        },
        { questionId: "q2", question: "What did you deliver?", sourceIds: [] },
      ],
    };
    const deps = dependencies({
      prepareGrounding: vi.fn().mockResolvedValue(context),
    });
    const response = await generateYcApplication(
      {
        ...selectedInput,
        request: {
          category: request.category,
          jd: request.jd,
          questions: context.questions!.map(({ question }) => question),
          selectedEvidenceIds: [selected],
        },
      },
      deps,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "EVIDENCE_SELECTION_UNAVAILABLE",
    });
    expect(deps.checkRateLimit).not.toHaveBeenCalled();
    expect(deps.createMessage).not.toHaveBeenCalled();
  });

  it("returns a legacy answer that uses the selected story", async () => {
    const context = {
      ...grounding(),
      requiredEvidenceRoots: [`evidence:${selected}`],
    };
    const deps = dependencies({
      prepareGrounding: vi.fn().mockResolvedValue(context),
    });
    const response = await generateYcApplication(selectedInput, deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ body: answer });
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).not.toHaveBeenCalled();
  });

  it("refunds a legacy answer that drops a feasible selected story after generation", async () => {
    const base = grounding();
    const root = `evidence:${second}`;
    const fact = "I wrote a separate reliability guide for engineers.";
    const context: YcGroundingContext = {
      ...base,
      requiredEvidenceRoots: [`evidence:${selected}`, root],
      sources: [
        ...base.sources,
        {
          id: root,
          type: "evidence",
          label: "Reliability guide",
          content: fact,
          priority: 1,
        },
      ],
      atomicSources: [
        ...base.atomicSources!,
        {
          id: root,
          rootId: root,
          scope: "candidate",
          kind: "action",
          content: fact,
        },
      ],
    };
    const deps = dependencies({
      prepareGrounding: vi.fn().mockResolvedValue(context),
    });
    const response = await generateYcApplication(
      {
        ...selectedInput,
        request: {
          ...selectedRequest,
          selectedEvidenceIds: [selected, second],
        },
      },
      deps,
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "YC_OUTPUT_INVALID" });
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
  });
});

it("allows a free-form answer requiring four complete facts from two selected stories", async () => {
  const facts = [
    "I designed an evaluation pipeline that measured customer response times during nightly runs.",
    "I investigated latency outliers by comparing dashboard traces against a representative traffic sample.",
    "I wrote integration tests that verified retry behavior during a brief production outage.",
    "I presented the findings to engineers and documented each actionable improvement for rollout.",
  ];
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  const context = buildYcGroundingContext({
    question: request.question,
    jobDescription: request.jd,
    selectedEvidenceIds: ids,
    candidate: {
      identity: { fullName: "", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
      resume: { text: "", source: "none" },
      confirmedEvidence: ids.map((id, index) => {
        const pair = facts.slice(index * 2, (index + 1) * 2);
        const story = {
          id,
          kind: "technical_project" as const,
          title: "Project " + index,
          context: "",
          actions: pair.join(" "),
          outcome: "",
          metrics: [],
          skills: [],
          links: [],
          confirmed: true,
          sortOrder: 0,
        };
        return {
          ...story,
          factReview: prepareFactReview(
            story,
            pair.map((excerpt, i) => ({
              id: i
                ? "33333333-3333-4333-8333-333333333333"
                : "44444444-4444-4444-8444-444444444444",
              kind: "action",
              confirmed: true,
              excerpt,
            })),
          ),
        };
      }),
    },
  });
  const output = {
    body: facts.join(" "),
    claims: context
      .atomicSources!.filter((s) => s.scope === "candidate")
      .map((s) => ({
        text: s.content,
        kind: s.kind,
        source_id: s.id,
        supporting_excerpt: s.content,
        sourceIds: [s.id],
      })),
  };
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
    parseMessage: vi.fn().mockReturnValue(output),
  });
  const response = await generateYcApplication(
    {
      caller,
      request: { ...request, selectedEvidenceIds: ids },
      corsHeaders: {},
      applicationBaseUrl: "https://example.test",
      rhetoricalPlans: false,
    },
    deps,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ body: output.body });
  expect(deps.createMessage).toHaveBeenCalledTimes(1);
});

it("allows an approved target fact to complete a free-form selected-story answer", async () => {
  const base = grounding();
  const root = base.sources[0]!.id;
  const evidence = "I built evaluation tools and documented their limits.";
  const target =
    "The team builds a platform for monitoring how production requests move between independent services, with a focus on finding failures in test environments and documenting what the operators can safely infer from the recorded behavior before making deployment decisions.";
  const targetText = `The supplied context says: "${target}"`;
  const context: YcGroundingContext = {
    ...base,
    requiredEvidenceRoots: [root],
    sources: [{ ...base.sources[0]!, content: evidence }],
    atomicSources: [
      {
        id: root,
        rootId: root,
        scope: "candidate",
        kind: "action",
        content: evidence,
      },
      {
        id: "target.jobDescription.0",
        scope: "target",
        kind: "target_observation",
        content: target,
      },
    ],
  };
  const output = {
    body: `${evidence} ${targetText}`,
    claims: context.atomicSources!.map((source) => ({
      text: source.scope === "candidate" ? evidence : targetText,
      kind: source.kind,
      source_id: source.id,
      supporting_excerpt: source.content,
      sourceIds: [source.id],
    })),
  };
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
    parseMessage: vi.fn().mockReturnValue(output),
  });
  const response = await generateYcApplication(
    {
      caller,
      request: {
        ...request,
        selectedEvidenceIds: [root.slice("evidence:".length)],
      },
      corsHeaders: {},
      applicationBaseUrl: "https://example.test",
      rhetoricalPlans: false,
    },
    deps,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ body: output.body });
  expect(deps.createMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      systemPrompt: expect.stringContaining("each selected evidence story"),
      userPrompt: expect.stringContaining(
        `<selected_evidence_story source_ids="${root}" />`,
      ),
    }),
  );
});

it("keeps unsafe reviewed and unreviewed story details out of the provider prompt", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const unsafe = "I verified the synthetic field containing 123-45-6789.";
  const story = {
    id,
    kind: "technical_project" as const,
    title: "Evaluation pipeline",
    context: "PRIVATE_UNREVIEWED_STORY_DETAIL",
    actions: answer + " " + unsafe,
    outcome: "",
    metrics: [],
    skills: [],
    links: [],
    confirmed: true,
    sortOrder: 0,
  };
  const context = buildYcGroundingContext({
    question: request.question,
    jobDescription: request.jd,
    selectedEvidenceIds: [id],
    candidate: {
      identity: { fullName: "", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
      resume: { text: "", source: "none" },
      confirmedEvidence: [
        {
          ...story,
          factReview: prepareFactReview(
            story,
            [answer, unsafe].map((excerpt, index) => ({
              id: index
                ? "33333333-3333-4333-8333-333333333333"
                : "44444444-4444-4444-8444-444444444444",
              kind: "action",
              confirmed: true,
              excerpt,
            })),
          ),
        },
      ],
    },
  });
  const approved = context.atomicSources!.find((s) => s.content === answer)!;
  const output = {
    body: answer,
    claims: [
      {
        text: approved.content,
        kind: approved.kind,
        source_id: approved.id,
        supporting_excerpt: approved.content,
        sourceIds: [approved.id],
      },
    ],
  };
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
    parseMessage: vi.fn().mockReturnValue(output),
  });
  const response = await generateYcApplication(
    {
      caller,
      request: { ...request, selectedEvidenceIds: [id] },
      corsHeaders: {},
      applicationBaseUrl: "https://example.test",
      rhetoricalPlans: false,
    },
    deps,
  );
  expect(response.status).toBe(200);
  expect(deps.createMessage).toHaveBeenCalledTimes(1);
  const { userPrompt } = vi.mocked(deps.createMessage).mock.calls[0]![0];
  expect(userPrompt).toContain(answer);
  expect(userPrompt).not.toMatch(/123-45-6789|PRIVATE_UNREVIEWED_STORY_DETAIL/);
});

it("accepts a complete approved quote when the direct wording falls below the word minimum", async () => {
  const base = grounding();
  const root = base.sources[0]!.id;
  const fact =
    "I built an evaluation service that captured synthetic request outcomes, compared those outcomes with documented policy expectations, and stored the disagreements for engineers to investigate before rollout, with the goal of making test cases reproducible without collecting any real customer records or including any confidential project names.";
  expect(fact.split(" ")).toHaveLength(47);
  const text = `My background includes: "${fact}"`;
  const context: YcGroundingContext = {
    ...base,
    requiredEvidenceRoots: [root],
    atomicSources: [
      {
        id: root,
        rootId: root,
        scope: "candidate",
        kind: "action",
        content: fact,
      },
    ],
  };
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
    parseMessage: vi.fn().mockReturnValue({
      body: text,
      claims: [
        {
          text,
          kind: "action",
          source_id: root,
          supporting_excerpt: fact,
          sourceIds: [root],
        },
      ],
    }),
  });
  const response = await generateYcApplication(
    {
      caller,
      request: {
        ...request,
        selectedEvidenceIds: [root.slice("evidence:".length)],
      },
      corsHeaders: {},
      applicationBaseUrl: "https://example.test",
      rhetoricalPlans: false,
    },
    deps,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ body: text });
});

describe("ALE-37 server-built YC answers", () => {
  const questions = [
    "Describe your relevant engineering work?",
    "How did you review difficult production changes?",
    "How did you help other engineers ship safely?",
    "How did you verify customer-facing delivery?",
    "What would you bring to this engineering team?",
  ];

  it.each([
    "legacy",
    "single",
    "five",
    "overlap",
    "multiline-overlap",
    "long-line-break-run",
    "exact-character-limit",
  ] as const)(
    "builds the %s answer text from ordered claims and preserves question order",
    async (mode) => {
      const submitted = questions.slice(0, mode === "five" ? 5 : 1);
      const source = grounding().atomicSources![0]!;
      const opening = "I reviewed TypeScript changes with engineers.";
      const opener = {
        ...source,
        id: "evidence:review",
        content:
          mode === "long-line-break-run"
            ? `I reviewed TypeScript changes.${"\n".repeat(100)}I shared the review findings with engineers.`
            : opening,
      };
      const atCharacterLimit = mode === "exact-character-limit";
      const hasMultilineOverlap =
        mode === "multiline-overlap" || atCharacterLimit;
      const hasOverlap = mode === "overlap" || hasMultilineOverlap;
      const combined = {
        ...source,
        id: "evidence:combined",
        content: [opening, source.content].join(
          hasMultilineOverlap ? "\n" : " ",
        ),
      };
      const extras = Array.from({ length: 5 }, (_, index) => ({
        ...source,
        id: `f${index}`,
        content: `Phase${" ".repeat(380)}${index}.`,
      }));
      const quoted = (text: string) => `My background includes: "${text}"`;
      if (atCharacterLimit) {
        const unpaddedLength = [
          opening,
          source.content,
          combined.content,
          ...extras.map((extra) => quoted(extra.content)),
        ].join("\n").length;
        expect(unpaddedLength).toBeLessThan(3_000);
        extras[0]!.content = extras[0]!.content.replace(
          "Phase",
          `Phase${" ".repeat(3_000 - unpaddedLength)}`,
        );
      }
      const context: YcGroundingContext = {
        ...grounding(),
        atomicSources: hasOverlap
          ? [source, opener, combined, ...(atCharacterLimit ? extras : [])]
          : [source, opener],
        ...(mode === "legacy"
          ? {}
          : {
              questions: submitted.map((question, i) => ({
                questionId: `q${i + 1}`,
                question,
                sourceIds: [source.rootId!],
              })),
            }),
      };
      const claim = (entry: typeof source) => ({
        text: entry.content,
        source_id: entry.id,
        supporting_excerpt: entry.content,
        kind: entry.kind,
      });
      const mockAnswers = submitted.map((_, i) => ({
        questionId: `q${i + 1}`,
        claims: hasOverlap
          ? [
              claim(opener),
              claim(source),
              claim(combined),
              ...(atCharacterLimit
                ? extras.map((extra) => ({
                    ...claim(extra),
                    text: quoted(extra.content),
                  }))
                : []),
            ]
          : i % 2
            ? [claim(source), claim(opener)]
            : [claim(opener), claim(source)],
      }));
      const deps = dependencies({
        prepareGrounding: vi.fn().mockResolvedValue(context),
        parseMessage: getYcApplicationToolInput,
        sanitizeOutput: sanitizeYcApplicationOutput,
        createMessage: vi.fn().mockResolvedValue({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              name:
                mode === "legacy"
                  ? "return_yc_application_answer"
                  : "return_application_answers",
              input:
                mode === "legacy"
                  ? { claims: mockAnswers[0]!.claims }
                  : { answers: [...mockAnswers].reverse() },
            },
          ],
          usage: { input_tokens: 120, output_tokens: 80 },
        }),
      });
      const result = await generateYcApplication(
        {
          caller,
          request:
            mode === "legacy"
              ? { ...request, question: submitted[0]! }
              : {
                  category: "yc_application",
                  jd: request.jd,
                  questions: submitted,
                },
          corsHeaders: {},
          applicationBaseUrl: "https://aletheia.live",
          rhetoricalPlans: false,
        },
        deps,
      );
      expect(result.status).toBe(200);
      const payload = await result.json();
      const expected = mockAnswers.map((entry, i) => {
        const [first, ...remaining] = entry.claims.map(({ text }) => text);
        const boundary = hasMultilineOverlap ? " " : "\n";
        const body = first + boundary + remaining.join("\n");
        return {
          questionId: entry.questionId,
          question: submitted[i],
          body,
          character_count: body.length,
          word_count: body.split(/\s+/u).length,
        };
      });
      if (atCharacterLimit) expect(expected[0]!.character_count).toBe(3_000);
      if (mode === "legacy") {
        expect(payload.body).toBe(expected[0]!.body);
        expect(payload.answers).toBeUndefined();
      } else {
        expect(payload.answers).toEqual(expected);
      }
      expect(payload.evalMetadata.groundingValidationPassed).toBe(true);
      expect(JSON.stringify(payload)).not.toMatch(
        /supporting_excerpt|source_id|evidence:/u,
      );
      expect(deps.createMessage).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).not.toHaveBeenCalled();
    },
  );
});

it("rejects an unapproved claims-only rewrite and compensates the request", async () => {
  const context = grounding();
  const source = context.atomicSources![0]!;
  const logger = createLogger("test-yc-coverage-repair");
  const warn = vi.spyOn(logger, "warn");
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
    parseMessage: getYcApplicationToolInput,
    createMessage: vi.fn().mockResolvedValue({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          name: "return_yc_application_answer",
          input: {
            claims: [
              {
                text: "I managed a division of 500 employees.",
                kind: source.kind,
                source_id: source.id,
                supporting_excerpt: source.content,
              },
            ],
          },
        },
      ],
      usage: { input_tokens: 120, output_tokens: 80 },
    }),
  });
  const result = await generateYcApplication(
    {
      caller,
      request,
      corsHeaders: {},
      applicationBaseUrl: "https://aletheia.live",
      rhetoricalPlans: false,
      logger,
    },
    deps,
  );
  expect(result.status).toBe(502);
  await expect(result.json()).resolves.toMatchObject({
    code: "YC_OUTPUT_INVALID",
  });
  expect(warn).toHaveBeenCalledWith(
    expect.objectContaining({
      validationStage: "grounding",
      validationCode: "CLAIM_REWRITE",
      itemIndex: 1,
    }),
    expect.any(String),
  );
  expect(deps.refundCredits).toHaveBeenCalledTimes(1);
  expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
});

it.each([
  "legacy",
  "single",
  "five",
  "selected",
  "too-short",
  "excluded",
] as const)("handles sparse approved YC evidence (%s)", async (mode) => {
  const actions =
    mode === "too-short"
      ? "The platform team improved TypeScript deployment reliability."
      : "The platform team implemented a TypeScript rollout for the customer dashboard, introduced a deployment checklist, compared reliability metrics after release, documented recovery steps for other engineers, coordinated stakeholder feedback, and reviewed every production change with the on-call engineer before gradually enabling the new dashboard.";
  const record = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "technical_project" as const,
    title: "TypeScript platform rollout",
    context: "",
    actions,
    outcome: "",
    metrics: [],
    skills: ["TypeScript"],
    links: [],
    confirmed: true,
    sortOrder: 0,
  };
  const question =
    "Describe your experience with a TypeScript platform rollout?";
  const questions =
    mode === "five"
      ? [
          question,
          ...Array.from(
            { length: 4 },
            (_, i) => `Describe TypeScript platform rollout example ${i + 1}?`,
          ),
        ]
      : [question];
  const jd =
    "The startup is hiring platform engineers to work on TypeScript dashboard rollouts and deployment reliability. "
      .repeat(7)
      .trim();
  const selectedEvidenceIds = mode === "selected" ? [record.id] : undefined;
  const courtesy = "Thank you for considering my application.";
  const context = buildYcGroundingContext({
    question,
    ...(mode !== "legacy" && { questions }),
    ...(selectedEvidenceIds && { selectedEvidenceIds }),
    jobDescription: jd,
    candidate: {
      identity: { fullName: "", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({
        currentRole: "Platform Engineer",
        ...(mode === "excluded" && { excludedClaims: [courtesy] }),
      }),
      resume: { text: "", source: "none" },
      confirmedEvidence: [
        {
          ...record,
          factReview: prepareFactReview(record, [
            {
              id: "22222222-2222-4222-8222-222222222222",
              kind: "action",
              excerpt: actions,
              confirmed: true,
            },
          ]),
        },
      ],
    },
  });
  expect(context.readiness.ready).toBe(true);
  expect(context.atomicSources).toHaveLength(1);
  const source = context.atomicSources![0]!;
  const [text] = allowedClaimTexts(source);
  const claims = [
    {
      text: text!,
      kind: source.kind,
      source_id: source.id,
      supporting_excerpt: source.content,
    },
  ];
  const deps = dependencies({
    prepareGrounding: vi.fn().mockResolvedValue(context),
    parseMessage: getYcApplicationToolInput,
    sanitizeOutput: vi.fn(sanitizeYcApplicationOutput),
    createMessage: vi.fn().mockResolvedValue({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          name:
            mode === "legacy"
              ? "return_yc_application_answer"
              : "return_application_answers",
          input:
            mode === "legacy"
              ? { claims }
              : {
                  answers: questions
                    .map((_, i) => ({ questionId: `q${i + 1}`, claims }))
                    .reverse(),
                },
        },
      ],
      usage: { input_tokens: 120, output_tokens: 80 },
    }),
  });
  const logger = createLogger("test-yc-sparse");
  const warn = vi.spyOn(logger, "warn");
  const response = await generateYcApplication(
    {
      caller,
      request:
        mode === "legacy"
          ? { category: "yc_application", jd, question }
          : {
              category: "yc_application",
              jd,
              questions,
              ...(selectedEvidenceIds && { selectedEvidenceIds }),
            },
      corsHeaders: {},
      applicationBaseUrl: "https://example.test",
      rhetoricalPlans: false,
      logger,
    },
    deps,
  );
  const payload = await response.json();
  expect(deps.createMessage).toHaveBeenCalledTimes(1);
  if (mode === "too-short" || mode === "excluded") {
    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      code: "YC_OUTPUT_INVALID",
      billing: "refunded",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        validationCode:
          mode === "too-short" ? "OUTPUT_LIMIT" : "CLAIM_EXCLUDED",
        itemIndex: 1,
      }),
      expect.any(String),
    );
    if (mode === "too-short") {
      expect(deps.sanitizeOutput).toHaveBeenCalledWith(
        expect.objectContaining({ body: text }),
      );
    }
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    return;
  }
  expect(response.status).toBe(200);
  const body = `${text}\n${courtesy}`;
  if (mode === "legacy") {
    expect(payload).toMatchObject({ body, word_count: 53 });
  } else {
    expect(payload.answers).toEqual(
      questions.map((question, i) => ({
        questionId: `q${i + 1}`,
        question,
        body,
        word_count: 53,
        character_count: body.length,
      })),
    );
  }
  expect(payload.evalMetadata.groundingValidationPassed).toBe(true);
  expect(JSON.stringify(payload)).not.toMatch(
    /supporting_excerpt|source_id|evidence:/u,
  );
  expect(deps.refundCredits).not.toHaveBeenCalled();
});
