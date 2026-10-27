import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { OutreachGroundingUnavailableError } from "@/modules/outreach/domain/outreach-grounding.types";

const mockAuthGetUser = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockAnthropicCreate = vi.hoisted(() => vi.fn());
const mockGetPrimaryResumeText = vi.hoisted(() => vi.fn());
const mockPrepareOutreachGroundingContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createBearerAuthClient: vi.fn(() => ({
    auth: { getUser: mockAuthGetUser },
  })),
  createBearerServiceClient: vi.fn(() => ({
    rpc: (...args: unknown[]) => {
      const response = Promise.resolve(mockRpc(...args));
      return Object.assign(response, { abortSignal: () => response });
    },
    from: mockFrom,
  })),
}));

vi.mock("@/lib/resumes/service", () => ({
  getPrimaryResumeText: mockGetPrimaryResumeText,
}));

vi.mock(
  "@/modules/outreach/application/prepare-outreach-grounding-context",
  () => ({
    prepareOutreachGroundingContext: async (...args: unknown[]) => {
      const context = await mockPrepareOutreachGroundingContext(...args);
      // Existing isolated route fixtures predate atomic target preparation.
      // Supply a complete target unit unless a test provides its own ledger.
      return {
        ...context,
        atomicSources: [
          ...(context.atomicSources ?? []),
          ...((context.atomicSources ?? []).some(
            (source: { scope: string }) => source.scope === "target",
          )
            ? []
            : [
                {
                  id: "target.profile.0",
                  scope: "target",
                  kind: "target_observation",
                  content: "Works on evaluation tooling.",
                },
              ]),
        ],
      };
    },
  }),
);

vi.mock("@anthropic-ai/sdk", () => {
  const AnthropicMock = vi.fn();
  AnthropicMock.prototype.messages = {
    create: mockAnthropicCreate,
  };
  // @ts-expect-error Test double only implements the shape the route checks.
  AnthropicMock.APIError = class APIError extends Error {
    status: number;
    constructor(status: number, _error: unknown, message: string) {
      super(message);
      this.status = status;
    }
  };
  // @ts-expect-error Test double only implements the shape the route checks.
  AnthropicMock.APIConnectionTimeoutError = class APIConnectionTimeoutError extends (
    Error
  ) {
    constructor(message = "Request timed out") {
      super(message);
      this.name = "APIConnectionTimeoutError";
    }
  };
  return { default: AnthropicMock };
});

vi.mock("@/lib/ai/sanitizer", () => ({
  sanitizeForLinkedIn: vi.fn().mockImplementation(async (content) => ({
    success: true,
    sanitizedContent: content,
    isAIGenerated: false,
  })),
  stripSurrogates: vi.fn((str) => str),
  stripModelPreambleAndSuffix: vi.fn((str) => str),
}));

const validPayload = {
  profileMarkdown:
    "# Jane Doe\nSoftware Engineer at Acme Corp\nSan Francisco, CA",
  jd: "Backend engineer role with AWS and AI systems.",
  category: "linkedin_connection",
};

function connectionCompositionBlock() {
  const targetObservation = "I'd welcome a conversation.";
  const cta = "Open to a brief chat?";
  return {
    type: "tool_use",
    id: "toolu_linkedin_connection",
    name: "return_linkedin_connection_composition",
    input: {
      claims: [],
      target_observation: targetObservation,
      candidate_relevance: null,
      cta,
      character_count: `${targetObservation} ${cta}`.length,
    },
  };
}

function coldEmailCompositionBlock() {
  return {
    type: "tool_use",
    id: "toolu_cold_email",
    name: "return_cold_email_composition",
    input: {
      subject_line: "Hello",
      greeting: "M",
      target_opening: "Hello",
      candidate_positioning: "Builder",
      proof_points: [],
      value_statement: "Relevant",
      cta: "Chat?",
    },
  };
}

function inmailDraftToolBlock() {
  return {
    type: "tool_use",
    id: "toolu_inmail",
    name: "return_email_draft",
    input: {
      subject_line: "Hello",
      body: "Hello",
      word_count: 1,
    },
  };
}

describe("ALE-63 focus rejection with credit billing enabled", () => {
  it.each([
    { messageFocus: "f".repeat(500), status: 409 },
    { messageFocus: "ALE63_PRIVATE_FOCUS".repeat(30), status: 400 },
    { messageFocus: " ".repeat(501), status: 400 },
    { messageFocus: "\ufb03".repeat(167), status: 400 },
    { messageFocus: { topic: "ALE63_PRIVATE_FOCUS" }, status: 400 },
    { messageFocus: null, status: 400 },
  ])(
    "returns $status without charging or calling the model %#",
    async ({ messageFocus, status }) => {
      const { POST } = await importRouteWithBillingEnabled();
      const response = await POST(
        makeRequest({
          method: "POST",
          headers: { Authorization: "Bearer test-token" },
          body: { ...validPayload, messageFocus },
        }),
      );
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(JSON.stringify(body)).not.toContain("ALE63_PRIVATE_FOCUS");
      if (status === 400)
        expect(body.details).toContainEqual(
          expect.objectContaining({ field: "messageFocus" }),
        );
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockPrepareOutreachGroundingContext).not.toHaveBeenCalled();
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    },
  );
});

async function importRouteWithBillingEnabled() {
  vi.resetModules();
  vi.stubEnv("CREDIT_BILLING_ENABLED", "true");
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  return import("./route");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  mockAuthGetUser.mockReset();
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockSelect.mockReset();
  mockEq.mockReset();
  mockMaybeSingle.mockReset();
  mockAnthropicCreate.mockReset();
  mockGetPrimaryResumeText.mockReset();
  mockPrepareOutreachGroundingContext.mockReset();

  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: "test-user-id", email: "user@example.com" } },
    error: null,
  });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
  mockGetPrimaryResumeText.mockResolvedValue({
    text: "Backend engineer with AWS, Terraform, Python, and AI systems experience.",
    source: "user_resumes",
  });
  mockAnthropicCreate.mockResolvedValue({
    content: [connectionCompositionBlock()],
    usage: { input_tokens: 100, output_tokens: 40 },
  });
  mockPrepareOutreachGroundingContext.mockResolvedValue({
    identity: { fullName: "Candidate Name", linkedinUrl: "" },
    sources: [],
    metadata: {
      groundingLevel: "target_only",
      fallbackReason: "no_resume_context",
      selectedSourceCount: 0,
      selectedEvidenceCount: 0,
      selectedSourceKinds: [],
      injectionSafeMode: false,
    },
  });
  mockRpc.mockImplementation(async (name: string) => {
    if (name === "reserve_generation_daily_slot") {
      return {
        data: [
          {
            allowed: true,
            remaining: 29,
            reset_time: new Date(Date.now() + 86_400_000).toISOString(),
            reservation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        ],
        error: null,
      };
    }
    if (name === "grant_trial_credits_once") {
      return { data: [{ granted: true, balance: 40 }], error: null };
    }
    if (name === "reserve_generation_credits") {
      return {
        data: [
          {
            allowed: true,
            reservation_id: "reservation-1",
            balance_after: 38,
          },
        ],
        error: null,
      };
    }
    if (name === "refund_generation_credits") {
      return { data: [{ refunded: true, balance: 40 }], error: null };
    }
    if (name === "start_generation_attempt") {
      return {
        data: [
          { allowed: true, attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
        ],
        error: null,
      };
    }
    if (
      name === "release_generation_daily_slot" ||
      name === "finish_generation_attempt"
    ) {
      return { data: true, error: null };
    }
    return { data: [], error: null };
  });
});

describe("POST /api/extension/generate with credit billing enabled", () => {
  it.each([97, 280, 301])(
    "preserves once-only credit/quota compensation for observation length %i",
    async (length) => {
      const block = connectionCompositionBlock();
      const excerpt = "x".repeat(length - 29);
      const observation = `The supplied context says: "${excerpt}"`;
      mockPrepareOutreachGroundingContext.mockResolvedValueOnce({
        identity: { fullName: "", linkedinUrl: "" },
        sources: [],
        metadata: {},
        atomicSources: [
          {
            id: "target.length",
            scope: "target",
            kind: "target_observation",
            content: excerpt,
          },
        ],
      });
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            ...block,
            input: {
              ...block.input,
              target_observation: observation,
              claims: [
                {
                  text: observation,
                  kind: "target_observation",
                  source_id: "target.length",
                  supporting_excerpt: excerpt,
                },
              ],
            },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      });
      const { POST } = await importRouteWithBillingEnabled();
      const res = await POST(
        makeRequest({
          method: "POST",
          headers: { authorization: "Bearer test" },
          body: validPayload,
        }),
      );
      const failed = length !== 97;
      expect(res.status).toBe(failed ? 502 : 200);
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
      for (const name of [
        "refund_generation_credits",
        "release_generation_daily_slot",
      ]) {
        expect(mockRpc.mock.calls.filter(([rpc]) => rpc === name)).toHaveLength(
          failed ? 1 : 0,
        );
      }
    },
  );
  it("does not reserve quota or credits when candidate context is unavailable", async () => {
    mockPrepareOutreachGroundingContext.mockRejectedValueOnce(
      new OutreachGroundingUnavailableError(),
    );
    const { POST } = await importRouteWithBillingEnabled();
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(res.status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("refunds credits and the exact daily slot when admission arrives too late", async () => {
    let elapsed = 0;
    const clock = vi
      .spyOn(performance, "now")
      .mockImplementation(() => elapsed);
    const originalRpc = mockRpc.getMockImplementation()!;
    mockRpc.mockImplementation(async (...args) => {
      const result = await originalRpc(...args);
      if (args[0] === "start_generation_attempt") elapsed = 181_000;
      return result;
    });
    try {
      const { POST } = await importRouteWithBillingEnabled();
      const response = await POST(
        makeRequest({
          method: "POST",
          headers: { authorization: "Bearer test" },
          body: validPayload,
        }),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBeNull();
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
      expect(
        mockRpc.mock.calls.filter(
          ([name]) => name === "refund_generation_credits",
        ),
      ).toHaveLength(1);
      const releases = mockRpc.mock.calls.filter(
        ([name]) => name === "release_generation_daily_slot",
      );
      expect(releases).toHaveLength(1);
      expect(releases[0]?.[1]).toMatchObject({
        p_reservation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      });
    } finally {
      clock.mockRestore();
    }
  });

  it("reserves credits and returns billing metadata on success", async () => {
    const { POST } = await importRouteWithBillingEnabled();

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      billingMode: "credits",
      creditCost: 2,
      creditsRemaining: 38,
    });
    expect(mockRpc).toHaveBeenCalledWith("grant_trial_credits_once", {
      p_user_id: "test-user-id",
      p_amount: 40,
    });
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation_credits", {
      p_user_id: "test-user-id",
      p_category: "linkedin_connection",
      p_cost: 2,
    });
    expect(mockRpc.mock.calls.map((call) => call[0])).not.toContain(
      "refund_generation_credits",
    );
  });

  it("does not reserve or debit credits for the development account", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: {
        user: {
          id: "dev-user-id",
          email: "nagarjunmallesh@gmail.com",
        },
      },
      error: null,
    });
    const { POST } = await importRouteWithBillingEnabled();

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    const body = await res.json();
    const rpcCalls = mockRpc.mock.calls.map((call) => call[0]);

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      billingMode: "unlimited_developer",
      creditCost: 0,
      creditsRemaining: null,
      unlimitedCredits: true,
    });
    expect(rpcCalls).toContain("reserve_generation_daily_slot");
    expect(rpcCalls).not.toContain("grant_trial_credits_once");
    expect(rpcCalls).not.toContain("reserve_generation_credits");
    expect(rpcCalls).not.toContain("refund_generation_credits");
  });

  it("returns 402 and releases the daily slot when credits are insufficient", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "reserve_generation_daily_slot") {
        return {
          data: [
            {
              allowed: true,
              remaining: 29,
              reset_time: new Date(Date.now() + 86_400_000).toISOString(),
              reservation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
          ],
          error: null,
        };
      }
      if (name === "grant_trial_credits_once") {
        return { data: [{ granted: false, balance: 1 }], error: null };
      }
      if (name === "reserve_generation_credits") {
        return {
          data: [{ allowed: false, reservation_id: null, balance_after: 1 }],
          error: null,
        };
      }
      if (name === "release_generation_daily_slot") {
        return { data: true, error: null };
      }
      return { data: [], error: null };
    });
    const { POST } = await importRouteWithBillingEnabled();

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body).toMatchObject({
      code: "INSUFFICIENT_CREDITS",
      creditCost: 2,
      creditsRemaining: 1,
    });
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(mockRpc.mock.calls.map((call) => call[0])).toContain(
      "release_generation_daily_slot",
    );
  });

  it("reports a pending daily slot when the insufficient-credit release fails", async () => {
    const originalRpc = mockRpc.getMockImplementation();
    mockRpc.mockImplementation(async (name: string, args: unknown) => {
      if (name === "reserve_generation_credits")
        return {
          data: [{ allowed: false, reservation_id: null, balance_after: 1 }],
          error: null,
        };
      if (name === "release_generation_daily_slot")
        return { data: null, error: { message: "PRIVATE" } };
      return originalRpc?.(name, args);
    });
    const { POST } = await importRouteWithBillingEnabled();
    const response = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({
      code: "INSUFFICIENT_CREDITS",
      quotaRestoration: "pending_review",
    });
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("reports both pending refunds when unusable output cannot be compensated", async () => {
    const originalRpc = mockRpc.getMockImplementation();
    mockRpc.mockImplementation(async (name: string, args: unknown) => {
      if (
        name === "refund_generation_credits" ||
        name === "release_generation_daily_slot"
      )
        return { data: null, error: { message: "PRIVATE" } };
      if (name === "reserve_generation_credits")
        return {
          data: [
            {
              allowed: true,
              reservation_id: "33333333-3333-4333-8333-333333333333",
              balance_after: 38,
            },
          ],
          error: null,
        };
      return originalRpc?.(name, args);
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not a valid tool result" }],
      usage: { input_tokens: 100, output_tokens: 40 },
    });
    const { POST } = await importRouteWithBillingEnabled();
    const response = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: "PARSE_FAILED",
      billing: "refund_pending",
      refundReference: "33333333-3333-4333-8333-333333333333",
      quotaRestoration: "pending_review",
    });
  });

  it("keeps a provider failure and failed compensation visible without leaking its error", async () => {
    const originalRpc = mockRpc.getMockImplementation();
    mockRpc.mockImplementation(async (name: string, args: unknown) => {
      if (
        name === "refund_generation_credits" ||
        name === "release_generation_daily_slot"
      )
        return { data: null, error: { message: "PRIVATE" } };
      if (name === "reserve_generation_credits")
        return {
          data: [
            {
              allowed: true,
              reservation_id: "44444444-4444-4444-8444-444444444444",
              balance_after: 38,
            },
          ],
          error: null,
        };
      return originalRpc?.(name, args);
    });
    mockAnthropicCreate.mockRejectedValueOnce(
      new Error("PRIVATE provider body"),
    );
    const { POST } = await importRouteWithBillingEnabled();
    const response = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      billing: "refund_pending",
      refundReference: "44444444-4444-4444-8444-444444444444",
      quotaRestoration: "pending_review",
    });
    expect(JSON.stringify(body)).not.toContain("PRIVATE");
  });

  it("refunds reserved credits when email tool output validation fails", async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "This is not JSON." }],
      usage: { input_tokens: 100, output_tokens: 40 },
    });
    const { POST } = await importRouteWithBillingEnabled();

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: { ...validPayload, category: "cold_email" },
      }),
    );

    expect(res.status).toBe(502);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation_credits", {
      p_user_id: "test-user-id",
      p_category: "cold_email",
      p_cost: 4,
    });
    expect(mockRpc).toHaveBeenCalledWith("refund_generation_credits", {
      p_user_id: "test-user-id",
      p_reservation_id: "reservation-1",
      p_amount: 4,
      p_metadata: { reason: "parse_failed" },
    });
    expect(mockRpc.mock.calls.map((call) => call[0])).toContain(
      "release_generation_daily_slot",
    );
  });

  it.each([
    ["cold_email", coldEmailCompositionBlock],
    ["linkedin_inmail", inmailDraftToolBlock],
  ] as const)(
    "refunds reserved credits when a %s body is below its minimum",
    async (category, buildBlock) => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [buildBlock()],
        usage: { input_tokens: 100, output_tokens: 40 },
      });
      const { POST } = await importRouteWithBillingEnabled();

      const res = await POST(
        makeRequest({
          method: "POST",
          headers: { authorization: "Bearer test" },
          body: { ...validPayload, category },
        }),
      );

      expect(res.status).toBe(502);
      expect(mockRpc).toHaveBeenCalledWith(
        "refund_generation_credits",
        expect.objectContaining({
          p_user_id: "test-user-id",
          p_reservation_id: "reservation-1",
          p_metadata: { reason: "parse_failed" },
        }),
      );
      expect(mockRpc.mock.calls.map((call) => call[0])).toContain(
        "release_generation_daily_slot",
      );
    },
  );

  it("refunds reserved credits when LinkedIn tool input is malformed", async () => {
    const block = connectionCompositionBlock();
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [
        {
          ...block,
          input: { ...block.input, cta: "" },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 40 },
    });
    const { POST } = await importRouteWithBillingEnabled();

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );

    expect(res.status).toBe(502);
    expect(mockRpc).toHaveBeenCalledWith("refund_generation_credits", {
      p_user_id: "test-user-id",
      p_reservation_id: "reservation-1",
      p_amount: 2,
      p_metadata: { reason: "parse_failed" },
    });
    expect(mockRpc.mock.calls.map((call) => call[0])).toContain(
      "release_generation_daily_slot",
    );
  });
});
