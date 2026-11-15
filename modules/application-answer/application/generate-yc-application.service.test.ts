import acceptanceFixture from "./fixtures/ale-68-reviewed-evidence.json";
import { allowedClaimTexts } from "@/modules/grounding/domain/atomic-claim";
import { describe, expect, it, vi } from "vitest";
import { SelectedEvidenceUnavailableError } from "@/modules/candidate-context/application/selected-evidence";
import Anthropic from "@anthropic-ai/sdk";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import {
  createYcApplicationDraft,
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
import { buildYcPlannedTool } from "../infrastructure/yc-planned-tool";
import { planSelection } from "@/modules/grounding/domain/rhetorical-plan";
import { startGenerationAttempt } from "@/modules/outreach/infrastructure/extension-generate.repository";
import {
  candidateEvidenceInputSchema,
  candidateProfileInputSchema,
} from "@/lib/candidate-profile/schema";

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
  it.each([
    [undefined, 1],
    [1, 2],
    [2, 4],
    [3, 5],
    [4, 7],
    [5, 8],
  ])(
    "checks YC question count %s at %i work units before the provider",
    async (questionCount, workUnits) => {
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
            ...(questionCount === undefined
              ? { question: request.question }
              : {
                  questions: Array.from(
                    { length: questionCount },
                    (_, index) =>
                      `Why does experience ${index + 1} fit this role?`,
                  ),
                }),
          },
          corsHeaders: {},
          applicationBaseUrl: "https://aletheia.live",
        },
        deps,
      );
      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({
        code: "WORK_BUDGET_REACHED",
      });
      expect(response.headers.get("Retry-After")).toMatch(/^\d+$/u);
      expect(deps.startAttempt).toHaveBeenCalledWith(
        caller.userId,
        expect.any(String),
        workUnits,
        expect.any(Object),
      );
      expect(deps.createMessage).not.toHaveBeenCalled();
      expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    },
  );

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

  it.each(
    [
      {
        label: "unrelated reviewed story",
        jd: "Quantum chemistry research studying molecular spectroscopy.",
        reviewed: "I built policy documentation tools.",
        unreviewed: "",
        outcome: "no_match",
      },
      {
        label: "AI keywords in an unreviewed sentence",
        jd: "Build AI agents.",
        reviewed: "I worked as a real estate agent.",
        unreviewed: "I built AI tools for property listings.",
        outcome: "weak_match",
      },
      {
        label: "two generic activities shared with real estate agents",
        question: "Describe how you onboarded and supported AI agents.",
        jd: "Build AI agents.",
        reviewed:
          "I onboarded and supported real estate agents at a local property brokerage. I introduced new colleagues to the listing process, answered questions about property viewings, reviewed offer paperwork with sellers, organized weekend appointments, maintained the office contact roster, and kept daily schedules up to date so the real estate office could handle customer inquiries.",
        unreviewed: "",
        outcome: "weak_match",
      },
      {
        label: "human agents backed by AI tools",
        question: "Describe how you onboarded and supported AI agents.",
        jd: "Build AI agents.",
        reviewed:
          "I onboarded and supported real estate agents backed by AI tools to organize appointments at a local property brokerage.",
        unreviewed: "",
        outcome: "weak_match",
      },
      {
        label: "spaced non AI qualifier on human-agent work",
        question: "Describe how you onboarded and supported AI agents.",
        jd: "Build AI agents.",
        reviewed:
          "I onboarded and supported non AI agents at a local property brokerage. I introduced new colleagues to the listing process, answered questions about property viewings, reviewed offer paperwork with sellers, organized weekend appointments, maintained the office contact roster, and kept daily schedules up to date so the real estate office could handle customer inquiries.",
        unreviewed: "",
        outcome: "weak_match",
      },
      {
        label: "generic framing shared with non-AI agents",
        question: "Tell me about a time you managed AI agents.",
        jd: "Build AI agents.",
        reviewed: "I managed real estate agents full time.",
        unreviewed: "",
        outcome: "weak_match",
      },
    ].flatMap((scenario) =>
      [1, 5].map((questionCount) => ({ ...scenario, questionCount })),
    ),
  )(
    "rejects $label in a $questionCount-question request before quota, credit and provider work",
    async ({
      question = request.question,
      questionCount,
      jd,
      reviewed,
      unreviewed,
      outcome,
    }) => {
      const evidence = {
        id: "synthetic-evidence",
        kind: "technical_project" as const,
        title: "Synthetic project",
        context: "",
        actions: [reviewed, unreviewed].filter(Boolean).join(" "),
        outcome: "",
        metrics: [],
        skills: [],
        links: [],
        confirmed: true,
        sortOrder: 0,
      };
      const questions = Array.from({ length: questionCount }, () => question);
      const context = buildYcGroundingContext({
        question,
        ...(questionCount > 1 ? { questions } : {}),
        jobDescription: jd,
        candidate: {
          identity: { fullName: "Synthetic", linkedinUrl: "" },
          profile: candidateProfileInputSchema.parse({
            currentRole: "Engineer",
          }),
          resume: { text: "", source: "none" },
          confirmedEvidence: [
            {
              ...evidence,
              factReview: prepareFactReview(evidence, [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  kind: "action",
                  excerpt: reviewed,
                  confirmed: true,
                },
              ]),
            },
          ],
        },
      });
      expect(context.selectionDiagnostics?.[0]?.outcome).toBe(outcome);
      const deps = dependencies({
        prepareGrounding: vi.fn().mockResolvedValue(context),
      });
      const response = await generateYcApplication(
        {
          caller,
          request: {
            category: "yc_application",
            jd,
            ...(questionCount > 1 ? { questions } : { question }),
          },
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
    },
  );

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
        promptVersion: "yc-2.3.0",
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

  it("compensates an upstream provider rate limit without retrying or returning a draft", async () => {
    const transport = vi
      .spyOn(Anthropic.prototype, "fetchWithTimeout")
      .mockImplementation(async () =>
        Response.json({ error: { type: "rate_limit_error" } }, { status: 429 }),
      );
    const deps = dependencies({
      createMessage: vi.fn(createYcApplicationDraft),
    });
    vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-key");
    try {
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
      const body = await response.json();
      expect(body).toMatchObject({
        code: "MODEL_UPSTREAM_ERROR",
        billing: "refunded",
        quotaRestoration: "released",
      });
      expect(body).not.toHaveProperty("body");
      expect(body).not.toHaveProperty("answers");
      expect(deps.startAttempt).toHaveBeenCalledTimes(1);
      expect(deps.createMessage).toHaveBeenCalledTimes(1);
      expect(transport).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).toHaveBeenCalledExactlyOnceWith(
        {
          userId: caller.userId,
          reservationId: "22222222-2222-4222-8222-222222222222",
          amount: 4,
        },
        "model_upstream_error",
        expect.anything(),
      );
      expect(deps.releaseRateLimit).toHaveBeenCalledExactlyOnceWith(
        caller.userId,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        expect.anything(),
      );
      expect(deps.finishAttempt).toHaveBeenCalledExactlyOnceWith(
        caller.userId,
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        expect.anything(),
      );
    } finally {
      transport.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe("ALE-37 batch orchestration", () => {
  const questions = [
    "Why are you a strong candidate?",
    "Describe your production experience?",
  ];
  const fiveQuestions = Array.from(
    { length: 5 },
    (_, index) =>
      `Describe your relevant experience for question ${index + 1}?`,
  );
  const run = (
    deps: GenerateYcApplicationDependencies,
    submittedQuestions = questions,
    jd = request.jd,
    rhetoricalPlans = false,
  ) =>
    generateYcApplication(
      {
        caller,
        rhetoricalPlans,
        request: {
          category: "yc_application",
          jd,
          questions: submittedQuestions,
        },
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
  function batchMessage(input: unknown) {
    return {
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", name: "return_application_answers", input },
      ],
      usage: { input_tokens: 120, output_tokens: 800 },
    } as Awaited<
      ReturnType<GenerateYcApplicationDependencies["createMessage"]>
    >;
  }
  function batchDeps(output: unknown = batch()) {
    return dependencies({
      createMessage: vi.fn().mockResolvedValue(batchMessage(output)),
    });
  }
  describe("question-specific reviewed facts", () => {
    const topics = [
      "Kubernetes",
      "Billing",
      "Accessibility",
      "Analytics",
      "Onboarding",
    ];
    const topicQuestions = topics.map(
      (topic) => `Describe your ${topic} experience?`,
    );
    const excerpts = topics.map(
      (topic) =>
        `I built a ${topic} workflow in TypeScript for an internal pilot. I wrote the initial implementation, documented the input format, and added test cases for the supported inputs. I also recorded the limits of the pilot, including the cases that had to be reviewed by another engineer before anyone could rely on the result.`,
    );

    function withReviewedFacts(
      submittedQuestions: string[],
      factIndices: number[][],
      reviewedExcerpts = excerpts,
      jobDescription = request.jd,
      title = "Internal pilot",
      storyCount = 1,
    ) {
      const record = {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "technical_project" as const,
        title,
        context: "",
        actions: "",
        outcome: "",
        metrics: [],
        skills: [],
        links: [],
        confirmed: true,
        sortOrder: 0,
      };
      const facts = reviewedExcerpts.map((excerpt, i) => ({
        id: `22222222-2222-4222-8222-22222222222${i}`,
        kind: "action" as const,
        excerpt,
        confirmed: true as const,
      }));
      const storyIds = [record.id, "33333333-3333-4333-8333-333333333333"];
      const reviewedStories = storyIds.slice(0, storyCount).map((id, index) => {
        const storyFacts = facts.filter((_, i) => i % storyCount === index);
        const story = {
          ...record,
          id,
          actions: storyFacts.map(({ excerpt }) => excerpt).join("\n"),
          sortOrder: index,
        };
        return {
          ...story,
          factReview: prepareFactReview(
            candidateEvidenceInputSchema.parse(story),
            storyFacts,
          ),
        };
      });
      const context = buildYcGroundingContext({
        question: submittedQuestions[0]!,
        questions: submittedQuestions,
        jobDescription,
        candidate: {
          identity: { fullName: "", linkedinUrl: "" },
          profile: candidateProfileInputSchema.parse({
            currentRole: "Engineer",
          }),
          resume: { text: "", source: "none" },
          confirmedEvidence: reviewedStories,
        },
      });
      const deps = dependencies({
        createMessage: vi.fn<
          GenerateYcApplicationDependencies["createMessage"]
        >(async ({ reviewedOptions }) => {
          const choices = (reviewedOptions ?? []).map(
            ({ questionId, options }, i) => {
              const expected = (factIndices[i] ?? []).map(
                (index) => facts[index]!.excerpt,
              );
              const option = expected.length
                ? options.find(
                    ({ claims }) =>
                      claims.length === expected.length &&
                      claims.every(({ supporting_excerpt }) =>
                        expected.includes(supporting_excerpt),
                      ),
                  )
                : options[0];
              return [questionId, option?.id ?? "unoffered"];
            },
          );
          return batchMessage(Object.fromEntries(choices.reverse()));
        }),
      });
      deps.prepareGrounding = vi.fn().mockResolvedValue(context);
      deps.sanitizeOutput = vi.fn(sanitizeYcApplicationOutput);
      return deps;
    }

    const deploymentReason =
      "Our reason for choosing Kubernetes for deployment and rollback was the availability of a repeatable recovery procedure.";
    it.each([
      ...[
        "Why did you choose to use Kubernetes for deployment and rollback?",
        "Why was Kubernetes chosen for deployment and rollback?",
        "What factors informed the decision to use Kubernetes for deployment and rollback?",
        "What drove your decision to use Kubernetes for deployment and rollback?",
        "What were your reasons for choosing Kubernetes for deployment and rollback?",
        "What motivated your choice of Kubernetes for deployment and rollback?",
        "What led to your decision to use Kubernetes for deployment and rollback?",
      ].map((question) => [question, deploymentReason]),
      [
        "Why did you end up using Kubernetes for deployment and rollback?",
        deploymentReason,
      ],
      [
        "Why did you choose Kubernetes for deployment and rollback?",
        "We chose Kubernetes for deployment and rollback. Our reason was that on-call engineers could exercise the same recovery procedure before an incident.",
      ],
      [
        "Why did you choose Kubernetes for deployment and rollback?",
        "We chose Kubernetes for deployment and rollback. Our reason was to make recovery rehearsals repeatable across engineering teams.",
      ],
      ...[
        "improved reliability during traffic spikes, especially when on-call engineers needed to repeat the tested rollback procedure",
        "24/7 availability of the repeatable recovery procedure",
        "that the repeatable recovery procedure was documented and familiar to every on-call team",
        "shared accountability for recovery across the two on-call teams",
      ].flatMap((reason) =>
        [
          `We chose Kubernetes for deployment and rollback. Our reason was ${reason}.`,
          `Our reason for choosing Kubernetes for deployment and rollback was ${reason}.`,
        ].map((excerpt) => [
          "Why did you choose Kubernetes for deployment and rollback?",
          excerpt,
        ]),
      ),
      [
        "Why did you continue using Kubernetes for deployment and rollback?",
        "We continued using Kubernetes for deployment and rollback because it let us reuse the recovery procedure that reviewers had already exercised.",
      ],
      [
        "For your public production rollout, why did you choose Kubernetes for deployment and rollback?",
        "For our public production rollout, we chose Kubernetes for deployment and rollback because it let on-call engineers use a recovery procedure they had already exercised.",
      ],
    ])(
      "rejects missing rationale and accepts reviewed rationale for %s",
      async (why, reason) => {
        const first = acceptanceFixture.cases[0]!;
        const second = acceptanceFixture.cases[1]!;
        const questions = [why, second.question];
        const jd = acceptanceFixture.jobDescription;
        const missing = withReviewedFacts(
          questions,
          [[0], [1]],
          [first.reviewedAction, second.reviewedAction],
          jd,
        );
        const rejection = await run(missing, questions, jd);
        expect(rejection.status).toBe(422);
        const error = await rejection.json();
        expect(error).toMatchObject({
          code: "GROUNDING_PROFILE_INCOMPLETE",
          billing: "none",
          applicationProfileUrl: expect.stringMatching(
            /\/dashboard#evidence$/u,
          ),
          evidenceGap: { reason: "missing_rationale", questionNumbers: [1] },
        });
        expect(error).not.toHaveProperty("answers");
        expect(missing.checkRateLimit).not.toHaveBeenCalled();
        expect(missing.grantTrialCredits).not.toHaveBeenCalled();
        expect(missing.reserveCredits).not.toHaveBeenCalled();
        expect(missing.startAttempt).not.toHaveBeenCalled();
        expect(missing.createMessage).not.toHaveBeenCalled();
        const reviewed = withReviewedFacts(
          questions,
          [[2, 0], [1]],
          [first.reviewedAction, second.reviewedAction, reason],
          jd,
        );
        const retry = await run(reviewed, questions, jd);
        expect({
          status: retry.status,
          body: await retry.json(),
        }).toMatchObject({
          status: 200,
          body: {
            answers: [
              { question: questions[0], body: expect.stringContaining(reason) },
              { question: questions[1], body: second.reviewedAction },
            ],
          },
        });
      },
    );

    it.each([
      "We chose Redis for deployment because a queue met our latency target. We documented that approach for the team alongside our usual Kubernetes deployment practices.",
      "We analyzed Kubernetes for deployment because we wanted to document the current architecture and share expected operational steps with the next team.",
    ])(
      "never substitutes a reviewed reason for a different decision %#",
      async (excerpt) => {
        const questions = [
          "What was the rationale for choosing Kubernetes for deployment?",
          "How did you write payroll tax reports?",
        ];
        const jd = acceptanceFixture.jobDescription;
        const deps = withReviewedFacts(questions, [[0], [0]], [excerpt], jd);
        const response = await run(deps, questions, jd);
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
          billing: "none",
          evidenceGap: { reason: "missing_rationale", questionNumbers: [1] },
        });
        expect(deps.checkRateLimit).not.toHaveBeenCalled();
        expect(deps.reserveCredits).not.toHaveBeenCalled();
        expect(deps.createMessage).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        "Why did you use Kubernetes for production deployment?",
        "We used Kubernetes for local development because Minikube ran our checks on one laptop. The production deployment used a separate managed runtime and the development team recorded those choices in the internal rollout plan with instructions for reproducing the tests without using any production infrastructure or shared data.",
      ],
      [
        "Why did you deploy using Kubernetes?",
        acceptanceFixture.cases[0]!.reviewedAction,
      ],
      [
        "Why did you continue using Kubernetes for deployment and rollback?",
        deploymentReason,
      ],
      [
        "For your public production rollout, why did you choose Kubernetes for deployment and rollback?",
        "We chose Kubernetes for deployment and rollback because it gave us an offline way to exercise the rollback procedure on synthetic workloads. This choice was only for an internal staging pilot using fictional data and never applied to our public production rollout, which ran on a different tool and was operated by another team.",
      ],
      ...[
        "Why did you decide on Kubernetes for deployment and rollback?",
        "Why was Kubernetes chosen for deployment and rollback?",
        "Why do you use Kubernetes for deployment and rollback?",
        "What was the rationale behind choosing Kubernetes for deployment and rollback?",
        "What factors informed the decision to use Kubernetes for deployment and rollback?",
        "What factors drove your Kubernetes deployment decision?",
      ].map((question) => [
        question,
        acceptanceFixture.cases[0]!.reviewedAction,
      ]),
    ])(
      "requires the reason for the specific choice in %s",
      async (question, excerpt) => {
        const jd = acceptanceFixture.jobDescription;
        const deps = withReviewedFacts([question], [[0]], [excerpt], jd);
        const response = await run(deps, [question], jd);
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
          evidenceGap: { reason: "missing_rationale", questionNumbers: [1] },
        });
        expect(deps.checkRateLimit).not.toHaveBeenCalled();
        expect(deps.reserveCredits).not.toHaveBeenCalled();
        expect(deps.createMessage).not.toHaveBeenCalled();
      },
    );

    it("answers five ordered questions with distinct reviewed facts from two projects", async () => {
      const questions = acceptanceFixture.cases.map(({ question }) => question);
      const facts = acceptanceFixture.cases.map(
        ({ reviewedAction }) => reviewedAction,
      );
      const jd = acceptanceFixture.jobDescription;
      const deps = withReviewedFacts(
        questions,
        questions.map((_, i) => [i]),
        facts,
        jd,
        acceptanceFixture.storyTitle,
        2,
      );
      const response = await run(deps, questions, jd);
      expect(response.status).toBe(200);
      const answer = await response.json();
      expect(
        answer.answers.map(
          ({ question, body }: { question: string; body: string }) => [
            question,
            body,
          ],
        ),
      ).toEqual(questions.map((question, index) => [question, facts[index]]));
      for (const { body, word_count, character_count } of answer.answers) {
        expect(word_count).toBeGreaterThanOrEqual(50);
        expect(word_count).toBeLessThanOrEqual(150);
        expect(character_count).toBe(body.length);
        expect(character_count).toBeLessThanOrEqual(3000);
      }
      expect(deps.createMessage).toHaveBeenCalledTimes(1);
    });

    it.each(
      [
        "recorded in a private planning document",
        "already documented in a private planning document",
        "recorded separately",
        "to be shared at a later date",
        "that it had been documented separately",
        "to be formally documented later",
        "an internal matter documented separately in a private planning document",
      ].flatMap((reference) => [
        `We chose Kubernetes for deployment and rollback. Our reason was ${reference}.`,
        `Our reason for choosing Kubernetes for deployment and rollback was ${reference}.`,
      ]),
    )(
      "requires the actual reason when a reviewed excerpt only refers to it %#",
      async (reference) => {
        const fixture = acceptanceFixture.cases[0]!;
        const questions = [
          "Why did you choose Kubernetes for deployment and rollback?",
        ];
        const jd = acceptanceFixture.jobDescription;
        const deps = withReviewedFacts(
          questions,
          [[0, 1]],
          [reference, fixture.reviewedAction],
          jd,
        );
        const response = await run(deps, questions, jd);
        expect(response.status).toBe(422);
        const error = await response.json();
        expect(error).toMatchObject({
          billing: "none",
          evidenceGap: { reason: "missing_rationale", questionNumbers: [1] },
        });
        expect(error).not.toHaveProperty("answers");
        expect(deps.checkRateLimit).not.toHaveBeenCalled();
        expect(deps.grantTrialCredits).not.toHaveBeenCalled();
        expect(deps.reserveCredits).not.toHaveBeenCalled();
        expect(deps.startAttempt).not.toHaveBeenCalled();
        expect(deps.createMessage).not.toHaveBeenCalled();
      },
    );

    it.each([
      { omitted: [3], count: 5 },
      { omitted: [1, 3], count: 5 },
      { omitted: [0], count: 1 },
    ])(
      "identifies unsupported question slots $omitted and accepts the original batch after review",
      async ({ omitted, count }) => {
        const cases = acceptanceFixture.cases.slice(0, count);
        const submitted = cases.map(({ question }) => question);
        const facts = acceptanceFixture.cases.map(
          ({ reviewedAction }) => reviewedAction,
        );
        const incompleteFacts = facts.filter((_, i) => !omitted.includes(i));
        const deps = withReviewedFacts(
          submitted,
          submitted.map(() => [0]),
          incompleteFacts,
          acceptanceFixture.jobDescription,
          acceptanceFixture.storyTitle,
        );

        const response = await run(
          deps,
          submitted,
          acceptanceFixture.jobDescription,
        );
        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body).toMatchObject({
          code: "GROUNDING_PROFILE_INCOMPLETE",
          billing: "none",
          evidenceGap: {
            reason: "missing_reviewed_facts",
            questionNumbers: omitted.map((index) => index + 1),
          },
        });
        expect(body).not.toHaveProperty("answers");
        expect(JSON.stringify(body)).not.toMatch(
          /fictional|22222222|How did/iu,
        );
        expect(deps.checkRateLimit).not.toHaveBeenCalled();
        expect(deps.grantTrialCredits).not.toHaveBeenCalled();
        expect(deps.reserveCredits).not.toHaveBeenCalled();
        expect(deps.createMessage).not.toHaveBeenCalled();

        const reviewed = withReviewedFacts(
          submitted,
          submitted.map((_, index) => [index]),
          facts,
          acceptanceFixture.jobDescription,
          acceptanceFixture.storyTitle,
        );
        const retry = await run(
          reviewed,
          submitted,
          acceptanceFixture.jobDescription,
        );
        expect(retry.status).toBe(200);
        expect(
          (await retry.json()).answers.map(
            ({ question }: { question: string }) => question,
          ),
        ).toEqual(submitted);
        expect(reviewed.createMessage).toHaveBeenCalledTimes(1);
      },
    );

    it.each([1, 2, 3, 4, 5])(
      "returns %i question-local answers with one reservation",
      async (count) => {
        const submitted = topicQuestions.slice(0, count);
        const deps = withReviewedFacts(
          submitted,
          submitted.map((_, i) => [i]),
        );
        const response = await run(deps, submitted);
        expect(response.status).toBe(200);
        expect((await response.json()).answers).toEqual(
          submitted.map((question, i) => ({
            questionId: `q${i + 1}`,
            question,
            body: excerpts[i],
            word_count: 54,
            character_count: excerpts[i]!.length,
          })),
        );
        expect(deps.createMessage).toHaveBeenCalledTimes(1);
        expect(deps.checkRateLimit).toHaveBeenCalledTimes(1);
        expect(deps.reserveCredits).toHaveBeenCalledTimes(1);
        expect(deps.refundCredits).not.toHaveBeenCalled();
        const [{ reviewedOptions, userPrompt }] = vi.mocked(deps.createMessage)
          .mock.calls[0]!;
        expect(reviewedOptions).toHaveLength(count);
        for (const [i, entry] of reviewedOptions!.entries()) {
          expect(entry.options).toHaveLength(1);
          expect(
            entry.options[0]?.claims.map((claim) => claim.supporting_excerpt),
          ).toEqual([excerpts[i]]);
        }
        expect(userPrompt).not.toMatch(
          /source_id|ATOMIC_SOURCES|candidate_sources|evidence:/u,
        );
      },
    );

    it("answers five questions from distinct reviewed facts across two projects", async () => {
      const deps = withReviewedFacts(
        topicQuestions,
        [[0], [1], [2], [3], [4]],
        excerpts,
        request.jd,
        "Internal pilot",
        2,
      );
      const response = await run(deps, topicQuestions);
      expect(response.status).toBe(200);
      expect((await response.json()).answers).toEqual(
        topicQuestions.map((question, index) =>
          expect.objectContaining({
            question,
            questionId: `q${index + 1}`,
            body: excerpts[index],
          }),
        ),
      );

      const sparse = withReviewedFacts(
        topicQuestions,
        [],
        [
          "I built a pilot covering Kubernetes, billing, accessibility, analytics, and onboarding, and recorded which workflows the team could test before production.",
          "I documented Kubernetes, billing, accessibility, analytics, and onboarding tradeoffs in a review guide and explained which inputs still needed manual checking.",
        ],
        request.jd,
        "Internal pilot",
        2,
      );
      const rejected = await run(sparse, topicQuestions);
      expect(rejected.status).toBe(422);
      const failure = await rejected.json();
      expect(failure).toMatchObject({
        code: "INSUFFICIENT_GROUNDING",
        billing: "none",
      });
      expect(failure).not.toHaveProperty("answers");
      expect(sparse.checkRateLimit).not.toHaveBeenCalled();
      expect(sparse.grantTrialCredits).not.toHaveBeenCalled();
      expect(sparse.reserveCredits).not.toHaveBeenCalled();
      expect(sparse.startAttempt).not.toHaveBeenCalled();
      expect(sparse.createMessage).not.toHaveBeenCalled();
    });

    it.each([
      { slots: [0] },
      { slots: [3] },
      { slots: [4] },
      { slots: [1, 3] },
    ])(
      "rejects an unsupported question at zero-based slots $slots before quota, billing, or provider work",
      async ({ slots }) => {
        const submitted = topicQuestions.map((question, index) =>
          slots.includes(index)
            ? "Which spectrometer resolved molecular absorption lines?"
            : question,
        );
        const deps = withReviewedFacts(
          submitted,
          submitted.map((_, i) => [i]),
        );
        const response = await run(deps, submitted);

        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body).toMatchObject({
          success: false,
          code: "GROUNDING_PROFILE_INCOMPLETE",
          billing: "none",
          evidenceGap: {
            reason: "missing_reviewed_facts",
            questionNumbers: slots.map((i) => i + 1),
          },
        });
        expect(body).not.toHaveProperty("answers");
        expect(body).not.toHaveProperty("body");
        expect(deps.checkRateLimit).not.toHaveBeenCalled();
        expect(deps.grantTrialCredits).not.toHaveBeenCalled();
        expect(deps.reserveCredits).not.toHaveBeenCalled();
        expect(deps.createMessage).not.toHaveBeenCalled();
      },
    );

    it("rejects a single relevant but too-short reviewed fact before admission", async () => {
      const { question, reviewedAction } = acceptanceFixture.cases[0]!;
      const shortFact = reviewedAction.split(" by ")[0] + ".";
      const deps = withReviewedFacts(
        [question],
        [[0]],
        [shortFact, acceptanceFixture.cases[1]!.reviewedAction],
        acceptanceFixture.jobDescription,
        acceptanceFixture.storyTitle,
      );

      const response = await run(
        deps,
        [question],
        acceptanceFixture.jobDescription,
      );

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "INSUFFICIENT_GROUNDING",
        billing: "none",
        evidenceGap: { reason: "incomplete_answer", questionNumbers: [1] },
      });
      expect(deps.checkRateLimit).not.toHaveBeenCalled();
      expect(deps.reserveCredits).not.toHaveBeenCalled();
      expect(deps.createMessage).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      "reports independent incomplete answers without blaming a viable slot (planned=%s)",
      async (planned) => {
        const cases = acceptanceFixture.cases.slice(0, 3);
        const submitted = cases.map(({ question }) => question);
        const facts = cases.map(({ reviewedAction }, index) =>
          index === 1 ? reviewedAction : reviewedAction.split(" by ")[0] + ".",
        );
        const deps = withReviewedFacts(
          submitted,
          [[0], [1], [2]],
          facts,
          acceptanceFixture.jobDescription,
          acceptanceFixture.storyTitle,
        );
        const prepared = await deps.prepareGrounding({
          caller,
          question: submitted[0]!,
          questions: submitted,
          jobDescription: acceptanceFixture.jobDescription,
        });
        expect(prepared.readiness.ready).toBe(true);
        expect(
          prepared.questions?.map((q) => q.reviewedFactIds?.length),
        ).toEqual([1, 1, 1]);

        const response = await run(
          deps,
          submitted,
          acceptanceFixture.jobDescription,
          planned,
        );
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
          code: "INSUFFICIENT_GROUNDING",
          billing: "none",
          evidenceGap: { reason: "incomplete_answer", questionNumbers: [1, 3] },
        });
        expect(deps.checkRateLimit).not.toHaveBeenCalled();
        expect(deps.grantTrialCredits).not.toHaveBeenCalled();
        expect(deps.reserveCredits).not.toHaveBeenCalled();
        expect(deps.createMessage).not.toHaveBeenCalled();
      },
    );

    it("reports every repeat of an infeasible question in the default generation path", async () => {
      const { question, reviewedAction } = acceptanceFixture.cases[0]!;
      const submitted = [question, question];
      const shortFact = reviewedAction.split(" by ")[0] + ".";
      const deps = withReviewedFacts(
        submitted,
        [[0], [0]],
        [shortFact],
        acceptanceFixture.jobDescription,
        acceptanceFixture.storyTitle,
      );

      const response = await run(
        deps,
        submitted,
        acceptanceFixture.jobDescription,
      );
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "INSUFFICIENT_GROUNDING",
        billing: "none",
        evidenceGap: { reason: "incomplete_answer", questionNumbers: [1, 2] },
      });
      expect(deps.checkRateLimit).not.toHaveBeenCalled();
      expect(deps.reserveCredits).not.toHaveBeenCalled();
      expect(deps.createMessage).not.toHaveBeenCalled();
    });

    it("offers a short direct match ahead of four longer weak matches", async () => {
      const question = "How did you roll back a failed Kubernetes deployment?";
      const jd =
        "Help a startup build, deploy, operate, and maintain a reliable application. Collaborate across projects.";
      const direct =
        "I rolled back a failed Kubernetes deployment by restoring the last working image after the readiness checks failed. I verified the pods recovered using deployment status and service checks, wrote down the image and the reason for restoring it, and asked the next engineer to repeat those checks in the training cluster.";
      const weak = ["monitoring", "capacity", "dashboard", "documentation"].map(
        (topic) =>
          `I helped plan a Kubernetes deployment by reviewing ${topic} requirements for a practice service. The work focused on collecting sample data from a disposable environment, comparing the notes with a shared project checklist, and reporting which details required further investigation before the project team could use the material for its regular weekly review meeting.`,
      );
      const deps = withReviewedFacts([question], [[4]], [...weak, direct], jd);
      const response = await run(deps, [question], jd);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        answers: [{ question, body: direct }],
      });
    });

    it("accepts a feasible reviewed fact when the best lexical match is too short", async () => {
      const question =
        "How did you verify Kubernetes deployment and rollback behavior?";
      const shortFact =
        "I checked Kubernetes deployment and rollback behavior in a fictional sandbox by setting up a disposable service, reviewing its readiness status, and recording the commands used to restore its previous configuration during a rehearsal with the platform team.";
      const completeFact =
        "I recovered a Kubernetes pod from a bad change in a fictional training cluster by inspecting its status and selecting the previous container image. I checked each stage against the written exercise, compared the new pod state with the original notes, and saved the steps in the training guide. Another engineer then repeated the exercise without help to check that the guide covered the whole procedure. I added instructions for identifying the affected service, recording the original image, reporting results, and resetting the training cluster for the next participant without touching production.";
      const deps = withReviewedFacts(
        [question],
        [[1]],
        [shortFact, completeFact],
      );

      const response = await run(deps, [question]);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        answers: [{ question, body: completeFact }],
      });
    });

    it.each([
      [1, false],
      [3, false],
      [5, false],
      [1, true],
      [5, true],
    ] as const)(
      "uses the acceptance fixture to answer %i distinct questions (planned=%s)",
      async (count, rhetoricalPlans) => {
        const cases = acceptanceFixture.cases.slice(0, count);
        const questions = cases.map(({ question }) => question);
        const facts = acceptanceFixture.cases.map(
          ({ reviewedAction }) => reviewedAction,
        );
        const deps = withReviewedFacts(
          questions,
          cases.map((_, index) => [index]),
          facts,
          acceptanceFixture.jobDescription,
          acceptanceFixture.storyTitle,
        );

        if (rhetoricalPlans) {
          vi.mocked(deps.createMessage).mockImplementation(
            async ({ plannedOptions }) => {
              const answers = plannedOptions!.map(
                ({ questionId, options }, index) => {
                  const option = options.find(
                    ({ body }) => body === cases[index]!.reviewedAction,
                  )!;
                  return {
                    questionId,
                    option_id: option.id,
                    rhetorical_plan: planSelection(option.rhetoricalPlan),
                  };
                },
              );
              return {
                stop_reason: "tool_use",
                content: [
                  {
                    type: "tool_use",
                    name: "return_application_answers",
                    input: { answers },
                  },
                ],
                usage: { input_tokens: 120, output_tokens: 80 },
              } as Awaited<
                ReturnType<GenerateYcApplicationDependencies["createMessage"]>
              >;
            },
          );
        }

        const response = await run(
          deps,
          questions,
          acceptanceFixture.jobDescription,
          rhetoricalPlans,
        );

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.answers).toEqual(
          cases.map(({ question, reviewedAction }, index) => ({
            questionId: `q${index + 1}`,
            question,
            body: reviewedAction,
            word_count: reviewedAction.split(/\s+/u).length,
            character_count: reviewedAction.length,
          })),
        );
        expect(
          new Set(payload.answers.map(({ body }: { body: string }) => body))
            .size,
        ).toBe(count);
        expect(deps.createMessage).toHaveBeenCalledTimes(1);
        const [{ userPrompt }] = vi.mocked(deps.createMessage).mock.calls[0]!;
        if (rhetoricalPlans) {
          expect(
            Array.from(
              userPrompt.matchAll(
                /<application_question id="q\d" source_ids="([^"]*)"/gu,
              ),
              ([, ids]) => ids,
            ),
          ).toEqual(
            cases.map((_, index) =>
              expect.stringMatching(
                new RegExp(`^evidence:[^ ]+22222222222${index}$`),
              ),
            ),
          );
        } else {
          expect(deps.createMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              reviewedOptions: expect.any(Array),
              systemPrompt: expect.stringContaining("chosen option ID"),
            }),
          );
          expect(userPrompt).not.toMatch(
            /source_id|ATOMIC_SOURCES|candidate_sources|evidence:/u,
          );
        }
      },
    );

    it("rejects a reviewed but unrelated fact from the same story", async () => {
      const submitted = [topicQuestions[0]!, topicQuestions[1]!];
      const deps = withReviewedFacts(submitted, [[0], [0, 1]]);
      const response = await run(deps, submitted);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: "YC_OUTPUT_INVALID",
        billing: "refunded",
      });
      expect(deps.refundCredits).toHaveBeenCalledTimes(1);
      expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    });

    it.each([
      "prose",
      "missing question",
      "extra question",
      "extra inherited-name field",
      "wrong type",
      "wrong question's option",
      "old claim indexes",
    ] as const)(
      "rejects %s in a reviewed selection without returning a partial batch",
      async (kind) => {
        const submitted = topicQuestions.slice(0, 2);
        const deps = withReviewedFacts(submitted, [[0], [1]]);
        const create = deps.createMessage;
        deps.createMessage = vi.fn(async (input) => {
          const message = await create(input);
          const block = message.content[0];
          if (!block || block.type !== "tool_use")
            throw new Error("Missing test tool");
          const choices = block.input as Record<string, unknown>;
          if (kind === "prose") choices.body = "Unreviewed copy";
          if (kind === "missing question") delete choices.q2;
          if (kind === "extra question") choices.q3 = "q3-1";
          if (kind === "extra inherited-name field")
            block.input = { ...choices, ["__proto__"]: "unoffered" };
          if (kind === "wrong type") choices.q2 = 1;
          if (kind === "wrong question's option") choices.q2 = choices.q1;
          if (kind === "old claim indexes")
            block.input = {
              answers: [
                {
                  questionId: "q1",
                  claims: [{ source_id: "unknown", text_index: 9 }],
                },
              ],
            };
          return message;
        });
        const response = await run(deps, submitted);
        expect(response.status).toBe(502);
        const payload = await response.json();
        expect(payload).toMatchObject({
          code: "YC_OUTPUT_INVALID",
          billing: "refunded",
        });
        expect(payload).not.toHaveProperty("answers");
        expect(deps.refundCredits).toHaveBeenCalledTimes(1);
        expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
      },
    );

    it("rejects an answer that skips the strongest match in favor of shared context", async () => {
      const submitted = [
        "How did you use TypeScript for Kubernetes?",
        "How did you use TypeScript for Billing?",
      ];
      // Both excerpts mention TypeScript. Each question also names its own topic.
      const deps = withReviewedFacts(submitted, [[0], [1]]);
      const response = await run(deps, submitted);
      expect(response.status).toBe(200);
      const { answers } = await response.json();
      expect(answers[1].body).toContain(excerpts[1]);
      const missingTopic = withReviewedFacts(submitted, [[0], [0, 2]]);
      const ungrounded = await run(missingTopic, submitted);
      expect(ungrounded.status).toBe(502);
      expect(await ungrounded.json()).toMatchObject({
        code: "YC_OUTPUT_INVALID",
        billing: "refunded",
      });
    });

    it("never offers the same complete claim set to different questions", async () => {
      const submitted = [
        "How did you use TypeScript for testing?",
        "What limits did you document for the TypeScript pilot?",
      ];
      const deps = withReviewedFacts(submitted, [[], []]);
      const response = await run(deps, submitted);
      expect(response.status).toBe(200);
      const { answers } = await response.json();
      expect(answers[0].body).not.toBe(answers[1].body);
      const [{ reviewedOptions }] = vi.mocked(deps.createMessage).mock
        .calls[0]!;
      const signatures = reviewedOptions!.flatMap(({ options }) =>
        options.map(({ claims }) =>
          claims
            .map(({ supporting_excerpt }) => supporting_excerpt)
            .sort()
            .join("\n"),
        ),
      );
      expect(new Set(signatures).size).toBe(signatures.length);
      expect(deps.createMessage).toHaveBeenCalledTimes(1);
      expect(deps.refundCredits).not.toHaveBeenCalled();
      expect(deps.releaseRateLimit).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      "compares planned batch answers by their claim sets (duplicate=%s)",
      async (duplicate) => {
        const submitted = [
          "How did you use TypeScript for testing?",
          "What limits did you document for the TypeScript pilot?",
        ];
        const deps = withReviewedFacts(
          submitted,
          [[0], [1]],
          [
            excerpts[0]!,
            excerpts[1]!.replace(
              "TypeScript for an internal pilot",
              "TypeScript for an internal pilot with documented limits",
            ),
          ],
        );
        deps.createMessage = vi.fn<
          GenerateYcApplicationDependencies["createMessage"]
        >(async ({ plannedOptions }) => {
          const options = plannedOptions!;
          expect(buildYcPlannedTool(options, true).description).toContain(
            "Choose a different claim_set for each question_group",
          );
          const shared = options[0]!.options.find((first) =>
            options[1]!.options.some(
              (second) => second.claimSet === first.claimSet,
            ),
          )!;
          expect(shared.claimSet).toBeDefined();
          const selection = options.map(({ questionId, options }, i) => {
            const option = options.find((entry) =>
              duplicate || i === 0
                ? entry.claimSet === shared.claimSet
                : entry.claimSet !== shared.claimSet,
            )!;
            return {
              questionId,
              option_id: option.id,
              rhetorical_plan: planSelection(option.rhetoricalPlan),
            };
          });
          return {
            stop_reason: "tool_use",
            content: [
              {
                type: "tool_use",
                name: "return_application_answers",
                input: { answers: selection },
              },
            ],
            usage: { input_tokens: 120, output_tokens: 80 },
          } as Awaited<
            ReturnType<GenerateYcApplicationDependencies["createMessage"]>
          >;
        });
        const result = await generateYcApplication(
          {
            caller,
            request: {
              category: "yc_application",
              jd: request.jd,
              questions: submitted,
            },
            corsHeaders: {},
            applicationBaseUrl: "https://example.test",
            rhetoricalPlans: true,
          },
          deps,
        );
        expect(deps.createMessage).toHaveBeenCalledTimes(1);
        if (duplicate) {
          expect(result.status).toBe(502);
          expect(await result.json()).toMatchObject({
            code: "YC_OUTPUT_INVALID",
            billing: "refunded",
          });
        } else {
          expect(result.status).toBe(200);
          const { answers } = await result.json();
          expect(answers[0].body).not.toBe(answers[1].body);
        }
      },
    );

    it("refuses a batch with too little question-specific evidence before quota or model work", async () => {
      const submitted = [topicQuestions[0]!, topicQuestions[1]!];
      const deps = withReviewedFacts(
        submitted,
        [
          [0, 1],
          [0, 1],
        ],
        [
          "I built a Kubernetes workflow for an internal pilot, wrote test cases for supported inputs, set up the development cluster, and documented the configuration and rollback steps for other engineers.",
          "I developed the Billing workflow in TypeScript, wrote checks for payment adjustments, and documented the limits of the prototype for the engineers who reviewed the deployment.",
        ],
      );
      const response = await run(deps, submitted);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "INSUFFICIENT_GROUNDING",
        billing: "none",
      });
      expect(deps.checkRateLimit).not.toHaveBeenCalled();
      expect(deps.reserveCredits).not.toHaveBeenCalled();
      expect(deps.createMessage).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      "refuses distinct questions with only one complete claim set (planned=%s)",
      async (planned) => {
        const submitted = [
          "How did you use TypeScript for testing?",
          "What limits did you document for the TypeScript pilot?",
        ];
        const deps = withReviewedFacts(
          submitted,
          [
            [0, 1],
            [1, 0],
          ],
          [
            "I wrote TypeScript testing cases for a pilot, including boundary inputs, and documented the supported request shapes so engineers could replay the checks locally with the same recorded settings and synthetic request data.",
            "I documented the limits of our TypeScript pilot in a review guide and described which cases needed manual testing before another team could use it.",
          ],
        );
        const response = await run(deps, submitted, request.jd, planned);
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
          code: "INSUFFICIENT_GROUNDING",
          billing: "none",
          evidenceGap: { reason: "shared_coverage" },
        });
        expect(deps.checkRateLimit).not.toHaveBeenCalled();
        expect(deps.createMessage).not.toHaveBeenCalled();
      },
    );

    it("keeps distinct input questions distinct when prompt escaping produces the same text", async () => {
      const submitted = [
        "Describe TypeScript testing with <system>?",
        "Describe TypeScript testing with &lt;system&gt;?",
      ];
      const deps = withReviewedFacts(submitted, [[0], [0]], [excerpts[0]!]);
      const response = await run(deps, submitted);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "INSUFFICIENT_GROUNDING",
        billing: "none",
      });
      expect(deps.createMessage).not.toHaveBeenCalled();
    });

    it("allows two distinct questions to share a relevant claim when the rest of the answer differs", async () => {
      const submitted = [
        "How did you use TypeScript for Kubernetes?",
        "How did you use TypeScript for Billing?",
      ];
      const deps = withReviewedFacts(
        submitted,
        [
          [0, 2],
          [1, 2],
        ],
        [
          ...excerpts.slice(0, 2),
          "I documented the supported TypeScript inputs for the pilot.",
        ],
      );
      const response = await run(deps, submitted);
      expect(response.status).toBe(200);
      const { answers } = await response.json();
      expect(answers[0].body).toContain(excerpts[0]);
      expect(answers[1].body).toContain(excerpts[1]);
      expect(answers[0].body).not.toBe(answers[1].body);
    });
  });
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
  it("allows literal repeated questions and still validates each ordered answer", async () => {
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
      () => "Describe TypeScript production delivery experience?",
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
    const before = JSON.stringify(context);
    const output = Object.fromEntries(
      fiveQuestions.map((_, i) => [`q${i + 1}`, `q${i + 1}-1`]),
    );
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
    const deps = batchDeps(batch(["q5", "q3", "q1", "q4", "q2"]));
    const response = await run(deps, fiveQuestions);
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
  it("rejects all five answers if the last one has an unsupported metric", async () => {
    const output = batch(["q1", "q2", "q3", "q4", "q5"]);
    output.answers[4]!.claims[0]!.text += " Increased revenue by 987%.";
    const deps = batchDeps(output);
    const response = await run(deps, fiveQuestions);
    expect(response.status).toBe(502);
    const result = await response.json();
    expect(result).toMatchObject({
      code: "YC_OUTPUT_INVALID",
      billing: "refunded",
    });
    expect(result).not.toHaveProperty("answers");
    expect(JSON.stringify(result)).not.toContain(answer);
    expect(deps.reserveCredits).toHaveBeenCalledTimes(1);
    expect(deps.createMessage).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    expect(deps.refundCredits).toHaveBeenCalledWith(
      {
        userId: caller.userId,
        reservationId: "22222222-2222-4222-8222-222222222222",
        amount: 4,
      },
      "yc_output_invalid",
      expect.anything(),
    );
    expect(deps.releaseRateLimit).toHaveBeenCalledTimes(1);
    expect(deps.releaseRateLimit).toHaveBeenCalledWith(
      caller.userId,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expect.anything(),
    );
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
      expect(body.evalMetadata.promptVersion).toBe("yc-3.1.0");
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
  "legacy-too-short",
  "legacy-excluded",
] as const)("handles sparse approved YC evidence (%s)", async (mode) => {
  const legacy = mode.startsWith("legacy");
  const tooShort = mode.endsWith("too-short");
  const excluded = mode.endsWith("excluded");
  const actions = tooShort
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
  const questions = Array.from(
    { length: mode === "five" ? 5 : 1 },
    () => question,
  );
  const jd =
    "The startup is hiring platform engineers to work on TypeScript dashboard rollouts and deployment reliability. "
      .repeat(7)
      .trim();
  const selectedEvidenceIds = mode === "selected" ? [record.id] : undefined;
  const courtesy = "Thank you for considering my application.";
  const context = buildYcGroundingContext({
    question,
    ...(!legacy && { questions }),
    ...(selectedEvidenceIds && { selectedEvidenceIds }),
    jobDescription: jd,
    candidate: {
      identity: { fullName: "", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({
        currentRole: "Platform Engineer",
        ...(excluded && { excludedClaims: [courtesy] }),
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
          name: legacy
            ? "return_yc_application_answer"
            : "return_application_answers",
          input: legacy
            ? { claims }
            : selectedEvidenceIds
              ? {
                  answers: questions
                    .map((_, i) => ({ questionId: `q${i + 1}`, claims }))
                    .reverse(),
                }
              : Object.fromEntries(
                  questions
                    .map((_, i) => [`q${i + 1}`, `q${i + 1}-1`])
                    .reverse(),
                ),
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
      request: legacy
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
  if (!legacy && (tooShort || excluded)) {
    expect(response.status).toBe(422);
    expect(payload).toMatchObject({
      code: "INSUFFICIENT_GROUNDING",
      billing: "none",
    });
    expect(warn).not.toHaveBeenCalled();
    expect(deps.checkRateLimit).not.toHaveBeenCalled();
    expect(deps.reserveCredits).not.toHaveBeenCalled();
    expect(deps.createMessage).not.toHaveBeenCalled();
    return;
  }
  expect(deps.createMessage).toHaveBeenCalledTimes(1);
  if (tooShort || excluded) {
    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      code: "YC_OUTPUT_INVALID",
      billing: "refunded",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        validationCode: tooShort ? "OUTPUT_LIMIT" : "CLAIM_EXCLUDED",
        itemIndex: 1,
      }),
      expect.any(String),
    );
    if (tooShort) {
      expect(deps.sanitizeOutput).toHaveBeenCalledWith(
        expect.objectContaining({ body: text }),
      );
    }
    expect(deps.refundCredits).toHaveBeenCalledTimes(1);
    return;
  }
  expect(response.status).toBe(200);
  const body = `${text}\n${courtesy}`;
  if (legacy) {
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
