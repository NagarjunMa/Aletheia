import { describe, it, expect, vi, beforeEach } from "vitest";
import { feedbackSchema } from "./schema";

// ─── Hoisted mocks for POST route tests ─────────────────────────────────────
const mockAuthGetUser = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockServiceFrom = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url: string, key: string) => {
    // Return different mocks for auth vs service depending on which key is passed.
    if (key && key.includes("anon")) {
      return { auth: { getUser: mockAuthGetUser } };
    }
    return {
      from: mockServiceFrom,
      rpc: mockRpc,
    };
  }),
}));

vi.mock("@/lib/cors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cors")>();
  return {
    ...actual,
    getCorsHeaders: vi.fn(actual.getCorsHeaders),
  };
});

// Wire chain: from("user_feedback").insert(...) or from("user_preferences").select(...).eq(...).maybeSingle() / upsert(...)
mockServiceFrom.mockImplementation((table: string) => {
  if (table === "user_feedback") return { insert: mockInsert };
  if (table === "user_preferences")
    return { select: mockSelect, upsert: mockUpsert };
  return { insert: mockInsert, upsert: mockUpsert, select: mockSelect };
});
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });

describe("feedbackSchema", () => {
  const validPayload = {
    message: "Hello, I wanted to reach out about your background.",
    approved: true,
    category: "linkedin_connection",
  };

  it("parses a valid payload", () => {
    const result = feedbackSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("parses with optional subjectLine", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      subjectLine: "Re: Opportunity",
    });
    expect(result.success).toBe(true);
  });

  it("parses with optional rejectionReason", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      approved: false,
      rejectionReason: "too_formal",
    });
    expect(result.success).toBe(true);
  });

  it("passes without rejectionReason (it is optional)", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      approved: false,
    });
    expect(result.success).toBe(true);
  });

  it("fails when message is missing", () => {
    const { message: _, ...withoutMessage } = validPayload;
    const result = feedbackSchema.safeParse(withoutMessage);
    expect(result.success).toBe(false);
  });

  it("fails when message is empty string", () => {
    const result = feedbackSchema.safeParse({ ...validPayload, message: "" });
    expect(result.success).toBe(false);
  });

  it("fails when approved is missing", () => {
    const { approved: _, ...withoutApproved } = validPayload;
    const result = feedbackSchema.safeParse(withoutApproved);
    expect(result.success).toBe(false);
  });

  it("fails when category is invalid", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      category: "instagram_post",
    });
    expect(result.success).toBe(false);
  });

  it("fails when rejectionReason is an invalid value", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      rejectionReason: "not_a_reason",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid category values", () => {
    const categories = [
      "linkedin_connection",
      "cold_email",
      "linkedin_inmail",
      "yc_application",
    ];
    for (const category of categories) {
      const result = feedbackSchema.safeParse({ ...validPayload, category });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid rejectionReason values", () => {
    const reasons = ["too_formal", "too_generic", "wrong_tone"];
    for (const rejectionReason of reasons) {
      const result = feedbackSchema.safeParse({
        ...validPayload,
        rejectionReason,
      });
      expect(result.success).toBe(true);
    }
  });

  it("parses with optional evalMetadata block", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      evalMetadata: {
        promptVersion: "1.0.0",
        model: "claude-sonnet-4-6",
        temperature: 0.8,
        category: "linkedin_connection",
        intent: "networking",
        emailMode: "initial_outreach",
        generationTimeMs: 1234,
        inputTokens: 500,
        outputTokens: 200,
        resumeSource: "user_resumes",
        hasPrimaryResume: true,
        injectionTriggered: false,
        safeCandidateSummaryUsed: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts YC provenance-safe eval metadata", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      category: "yc_application",
      evalMetadata: {
        generationId: "33333333-3333-4333-8333-333333333333",
        promptVersion: "yc-1.0.0",
        model: "claude-sonnet-4-6",
        category: "yc_application",
        generationTimeMs: 125,
        inputTokens: 120,
        outputTokens: 80,
        profileFieldCount: 2,
        confirmedEvidenceCount: 1,
        resumeSource: "user_resumes",
        injectionTriggered: false,
        groundingValidationPassed: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects feedback whose outer category disagrees with eval metadata", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      category: "cold_email",
      evalMetadata: {
        generationId: "33333333-3333-4333-8333-333333333333",
        promptVersion: "yc-1.0.0",
        model: "claude-sonnet-4-6",
        category: "yc_application",
        generationTimeMs: 125,
        inputTokens: 120,
        outputTokens: 80,
        profileFieldCount: 2,
        confirmedEvidenceCount: 1,
        resumeSource: "user_resumes",
        injectionTriggered: false,
        groundingValidationPassed: true,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects evalMetadata with missing required field", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      evalMetadata: {
        promptVersion: "1.0.0",
        model: "claude-sonnet-4-6",
        // missing temperature, category, intent, generationTimeMs, etc.
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects evalMetadata with unknown extra field (strict mode)", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      evalMetadata: {
        promptVersion: "1.0.0",
        model: "claude-sonnet-4-6",
        temperature: 0.8,
        category: "linkedin_connection",
        intent: "networking",
        generationTimeMs: 1234,
        inputTokens: 500,
        outputTokens: 200,
        nefarious: "inject me",
      },
    });
    expect(result.success).toBe(false);
  });
});

// ─── POST route tests (T8, T9, T10) ─────────────────────────────────────────
import { POST } from "./route";
import { makeRequest } from "@/__tests__/helpers/request";

const validBody = {
  message: "Hi Priya — short personal note.",
  approved: true,
  category: "linkedin_connection",
};

describe("POST /api/extension/feedback — dual-behavior persistence contract", () => {
  it("rejects unsupported API versions before authentication", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: {
          "X-Aletheia-API-Version": "2",
          "X-Aletheia-Extension-Version": "1.0.3",
        },
      }),
    );

    expect(res.status).toBe(426);
    await expect(res.json()).resolves.toMatchObject({
      code: "API_VERSION_UNSUPPORTED",
    });
    expect(mockAuthGetUser).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    mockAuthGetUser.mockReset();
    mockInsert.mockReset();
    mockUpsert.mockReset();
    mockRpc.mockReset();
    mockMaybeSingle.mockReset();

    // Default: authenticated user
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id", email: "u@example.com" } },
      error: null,
    });
    // Default: no existing prefs row
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    // Default: insert + RPC succeed
    mockInsert.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ error: null });
    mockUpsert.mockResolvedValue({ error: null });
  });

  // T8 — sync user_feedback insert + 200
  it("inserts user_feedback row synchronously and returns 200", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validBody,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockServiceFrom).toHaveBeenCalledWith("user_feedback");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          extension_version: "1.0.2",
          extension_api_version: "1",
          legacy_extension_client: true,
        }),
      }),
    );
  });

  // T8 — fire-and-forget guarantee (RPC error must not affect HTTP response)
  it("returns 200 even when style RPC throws (fire-and-forget guarantee)", async () => {
    mockRpc.mockRejectedValueOnce(new Error("RPC crashed"));
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validBody,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  // T8 — insert error is logged but does not propagate as 5xx
  it("returns 200 even when user_feedback insert errors (logged not propagated)", async () => {
    mockInsert.mockResolvedValueOnce({
      error: { message: "constraint violation" },
    });
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validBody,
      }),
    );
    expect(res.status).toBe(200);
  });

  // T9 — approved messages fire the style-merge RPC
  it("calls increment_approved_count RPC on approved message", async () => {
    await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: {
          message: "Hey Priya, your sparse attention work caught my eye.",
          approved: true,
          category: "linkedin_connection",
        },
      }),
    );
    // Allow fire-and-forget Promise to resolve
    await new Promise((r) => setImmediate(r));
    expect(mockRpc).toHaveBeenCalled();
    const rpcCallName = mockRpc.mock.calls[0]?.[0] as string;
    expect(rpcCallName).toMatch(/approved|increment|style/i);
  });

  // T10 — RPC unavailable triggers user_preferences upsert fallback
  it("falls back to user_preferences upsert when style RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({
      error: { code: "42883", message: "function not found" },
    });
    await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validBody,
      }),
    );
    await new Promise((r) => setImmediate(r));
    expect(mockRpc).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalled();
  });
});
