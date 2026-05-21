import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { settingsSchema } from "./schema";

// ─── Hoisted mocks (handler tests only) ─────────────────────────────────────
const mockGetUser = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// ─── Route handler ────────────────────────────────────────────────────────────
import { PATCH, GET, OPTIONS } from "./route";

// ─── Test fixtures ────────────────────────────────────────────────────────────
const MOCK_USER = { id: "user-uuid-abc", email: "user@example.com" };
const MOCK_PREFS = {
  id: 1,
  user_id: MOCK_USER.id,
  theme: "dark",
  formality_level: "neutral",
};

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  mockGetUser.mockReset();
  mockSingle.mockReset();
  mockUpsert.mockReset();
  mockSelect.mockReset();
  mockFrom.mockReset();
  mockEq.mockReset();

  // Re-establish upsert chain: from().upsert().select().single()
  mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq });
  mockUpsert.mockReturnValue({ select: mockSelect });
  // Re-establish select chain for GET: from().select().eq().single()
  mockEq.mockReturnValue({ single: mockSingle });
  mockFrom.mockReturnValue({ upsert: mockUpsert, select: mockSelect });
});

// ─── Schema Tests (preserved) ─────────────────────────────────────────────────
describe("settingsSchema", () => {
  it("parses a valid formality_level", () => {
    const result = settingsSchema.safeParse({ formality_level: "casual" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid formality_level values", () => {
    for (const level of ["casual", "neutral", "formal"]) {
      expect(settingsSchema.safeParse({ formality_level: level }).success).toBe(
        true,
      );
    }
  });

  it("fails when formality_level is invalid", () => {
    const result = settingsSchema.safeParse({ formality_level: "very_formal" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid theme values", () => {
    for (const theme of ["light", "dark", "system"]) {
      expect(settingsSchema.safeParse({ theme }).success).toBe(true);
    }
  });

  it("fails when theme is invalid", () => {
    const result = settingsSchema.safeParse({ theme: "rainbow" });
    expect(result.success).toBe(false);
  });

  it("accepts share_analytics as boolean", () => {
    expect(settingsSchema.safeParse({ share_analytics: true }).success).toBe(
      true,
    );
    expect(settingsSchema.safeParse({ share_analytics: false }).success).toBe(
      true,
    );
  });

  it("accepts reset_style: true alongside other fields", () => {
    const result = settingsSchema.safeParse({
      formality_level: "neutral",
      theme: "dark",
      reset_style: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields are optional)", () => {
    const result = settingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("fails when share_analytics is not a boolean", () => {
    const result = settingsSchema.safeParse({ share_analytics: "yes" });
    expect(result.success).toBe(false);
  });
});

// ─── Handler Tests ────────────────────────────────────────────────────────────
describe("PATCH /api/settings", () => {
  describe("authentication guard", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "not authenticated" },
      });

      const res = await PATCH(
        makeRequest({ method: "PATCH", body: { theme: "dark" } }),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when getUser returns auth error", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "JWT expired" },
      });

      const res = await PATCH(makeRequest({ method: "PATCH", body: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe("happy path", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    });

    it("returns 200 with updated preferences for a valid request", async () => {
      mockSingle.mockResolvedValue({ data: MOCK_PREFS, error: null });

      const res = await PATCH(
        makeRequest({ method: "PATCH", body: { theme: "dark" } }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.preferences).toEqual(MOCK_PREFS);
    });

    it("passes user_id and patch fields to the upsert call", async () => {
      mockSingle.mockResolvedValue({ data: MOCK_PREFS, error: null });

      await PATCH(
        makeRequest({
          method: "PATCH",
          body: { theme: "dark", formality_level: "formal" },
        }),
      );

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_USER.id,
          theme: "dark",
          formality_level: "formal",
        }),
        expect.objectContaining({ onConflict: "user_id" }),
      );
    });
  });

  describe("reset_style business logic", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
      mockSingle.mockResolvedValue({ data: MOCK_PREFS, error: null });
    });

    it("sets style_patterns to null and resets counts when reset_style is true", async () => {
      // This is pure business logic that cannot be verified via E2E.
      // The style reset must zero out two separate counters AND null the patterns.
      await PATCH(
        makeRequest({ method: "PATCH", body: { reset_style: true } }),
      );

      const upsertArg = mockUpsert.mock.calls[0]![0] as Record<string, unknown>;
      expect(upsertArg.style_patterns).toBeNull();
      expect(upsertArg.approved_message_count).toBe(0);
      expect(upsertArg.rejected_message_count).toBe(0);
    });

    it("does NOT include style_patterns key when reset_style is false", async () => {
      await PATCH(makeRequest({ method: "PATCH", body: { theme: "light" } }));

      const upsertArg = mockUpsert.mock.calls[0]![0] as Record<string, unknown>;
      expect(upsertArg).not.toHaveProperty("style_patterns");
      expect(upsertArg).not.toHaveProperty("approved_message_count");
    });

    it("does NOT pass reset_style itself to the upsert payload", async () => {
      await PATCH(
        makeRequest({ method: "PATCH", body: { reset_style: true } }),
      );

      const upsertArg = mockUpsert.mock.calls[0]![0] as Record<string, unknown>;
      // reset_style is a control flag — it must not be persisted to the DB
      expect(upsertArg).not.toHaveProperty("reset_style");
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    });

    it("returns 500 when Supabase upsert fails", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "unique constraint violated" },
      });

      const res = await PATCH(
        makeRequest({ method: "PATCH", body: { theme: "dark" } }),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("returns 400 when body is invalid JSON", async () => {
      const req = new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json {{",
      }) as any;

      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when schema validation fails (invalid theme)", async () => {
      const res = await PATCH(
        makeRequest({ method: "PATCH", body: { theme: "deep-purple" } }),
      );
      expect(res.status).toBe(400);
    });
  });
});

// ─── GET /api/settings ────────────────────────────────────────────────────────
describe("GET /api/settings", () => {
  const MOCK_PROFILE = {
    resume: "Software engineer with 5 years experience",
    target_job_description: "Looking for senior roles",
    resume_updated_at: "2026-05-01T12:00:00Z",
  };

  describe("authentication guard", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "not authenticated" },
      });

      const res = await GET(makeRequest({ method: "GET" }));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when getUser returns auth error with null user", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "JWT expired" },
      });

      const res = await GET(makeRequest({ method: "GET" }));
      expect(res.status).toBe(401);
    });
  });

  describe("happy path", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    });

    it("returns 200 with resume, target_job_description, and resume_updated_at", async () => {
      mockSingle.mockResolvedValue({ data: MOCK_PROFILE, error: null });

      const res = await GET(makeRequest({ method: "GET" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.resume).toBe(MOCK_PROFILE.resume);
      expect(body.target_job_description).toBe(
        MOCK_PROFILE.target_job_description,
      );
      expect(body.resume_updated_at).toBe(MOCK_PROFILE.resume_updated_at);
    });

    it("returns null fields when profile has no resume or JD", async () => {
      mockSingle.mockResolvedValue({
        data: {
          resume: null,
          target_job_description: null,
          resume_updated_at: null,
        },
        error: null,
      });

      const res = await GET(makeRequest({ method: "GET" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.resume).toBeNull();
      expect(body.target_job_description).toBeNull();
      expect(body.resume_updated_at).toBeNull();
    });

    it("queries profiles table with correct user id", async () => {
      mockSingle.mockResolvedValue({ data: MOCK_PROFILE, error: null });

      await GET(makeRequest({ method: "GET" }));

      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockEq).toHaveBeenCalledWith("id", MOCK_USER.id);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    });

    it("returns 500 when Supabase profile fetch fails", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "relation does not exist" },
      });

      const res = await GET(makeRequest({ method: "GET" }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });
  });
});

// ─── OPTIONS /api/settings ────────────────────────────────────────────────────
describe("OPTIONS /api/settings", () => {
  it("returns 204 for CORS preflight", async () => {
    const res = await OPTIONS(makeRequest({ method: "OPTIONS" }));
    expect(res.status).toBe(204);
  });
});
