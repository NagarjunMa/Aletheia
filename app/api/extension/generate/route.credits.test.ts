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
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

vi.mock("@/lib/resumes/service", () => ({
  getPrimaryResumeText: mockGetPrimaryResumeText,
}));

vi.mock(
  "@/modules/outreach/application/prepare-outreach-grounding-context",
  () => ({
    prepareOutreachGroundingContext: mockPrepareOutreachGroundingContext,
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
  profileUrl: "https://linkedin.com/in/janedoe",
  jd: "Backend engineer role with AWS and AI systems.",
  category: "linkedin_connection",
};

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
    content: [{ type: "text", text: "Hi Jane, nice to connect." }],
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
    if (name === "check_and_increment_rate_limit") {
      return {
        data: [
          {
            allowed: true,
            remaining: 29,
            reset_time: new Date(Date.now() + 86_400_000).toISOString(),
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
    if (name === "release_rate_limit_reservation") {
      return { data: [{ released: true }], error: null };
    }
    return { data: [], error: null };
  });
});

describe("POST /api/extension/generate with credit billing enabled", () => {
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
    expect(rpcCalls).toContain("check_and_increment_rate_limit");
    expect(rpcCalls).not.toContain("grant_trial_credits_once");
    expect(rpcCalls).not.toContain("reserve_generation_credits");
    expect(rpcCalls).not.toContain("refund_generation_credits");
  });

  it("returns 402 and releases the daily slot when credits are insufficient", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "check_and_increment_rate_limit") {
        return {
          data: [
            {
              allowed: true,
              remaining: 29,
              reset_time: new Date(Date.now() + 86_400_000).toISOString(),
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
      if (name === "release_rate_limit_reservation") {
        return { data: [{ released: true }], error: null };
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
      "release_rate_limit_reservation",
    );
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
      "release_rate_limit_reservation",
    );
  });
});
