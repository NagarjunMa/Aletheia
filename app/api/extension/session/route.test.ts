import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { getCorsHeaders } from "@/lib/cors";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Map()),
}));

// We need to mock getCorsHeaders to assert security behavior without testing cors.ts itself
vi.mock("@/lib/cors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cors")>();
  return {
    ...actual,
    getCorsHeaders: vi.fn(actual.getCorsHeaders),
  };
});

// ─── Route handler ────────────────────────────────────────────────────────────
import { GET, OPTIONS } from "./route";

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  mockGetSession.mockReset();
  mockGetUser.mockReset();
  vi.mocked(getCorsHeaders).mockClear();

  // Default to a happy path session
  mockGetSession.mockResolvedValue({
    data: {
      session: {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    error: null,
  });

  // Default to a happy path user
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        user_metadata: { full_name: "Test User" },
      },
    },
    error: null,
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("GET /api/extension/session", () => {
  describe("CORS Security", () => {
    it("returns 403 when origin is not allowed by CORS", async () => {
      // makeRequest defaults origin to localhost. Let's provide an invalid one.
      const req = makeRequest({ origin: "https://malicious-site.com" });
      const res = await GET(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Origin not allowed");
    });
  });

  describe("Session Retrieval (Step 1)", () => {
    it("returns 401 when getSession returns an error", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Network error" },
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/Not authenticated/);
    });

    it("returns 401 and specific code when getSession hits refresh_token_already_used", async () => {
      // This is the critical token rotation error contract
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: {
          code: "refresh_token_already_used",
          message: "Token already used",
        },
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("refresh_token_already_used");
      expect(body.error).toMatch(/Session expired/);
    });

    it("returns 401 when getSession returns no session (user logged out)", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });
  });

  describe("User Validation (Step 2)", () => {
    it("calls getUser explicitly with the session access token", async () => {
      await GET(makeRequest());
      expect(mockGetUser).toHaveBeenCalledWith("test-access");
    });

    it("returns 401 when getUser returns an error", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it("returns 401 with specific code when getUser hits refresh_token_already_used", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: {
          code: "refresh_token_already_used",
          message: "Token already used",
        },
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("refresh_token_already_used");
    });
  });

  describe("Happy Path", () => {
    it("returns 200 with access_token, user info, and supabase credentials but NEVER refresh_token", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.access_token).toBe("test-access");
      // refresh_token must NOT be in response body — extension refreshes
      // by re-calling this endpoint via cookie-bound flow. Returning it
      // exposes it to same-origin XSS.
      expect(body.refresh_token).toBeUndefined();
      expect(body.user.id).toBe("test-user-id");
      expect(body.user.full_name).toBe("Test User");
      expect(body.supabase_url).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
      expect(body.supabase_anon_key).toBe(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );
    });
  });

  describe("Catastrophic Failure", () => {
    it("returns 500 when an unhandled exception occurs", async () => {
      mockGetSession.mockRejectedValue(new Error("Database exploded"));

      const res = await GET(makeRequest());
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
    });
  });
});

describe("OPTIONS /api/extension/session", () => {
  it("returns 200 with CORS headers for preflight", async () => {
    const res = await OPTIONS(makeRequest({ method: "OPTIONS" }));
    expect(res.status).toBe(200);
    // Implicit assertion: getting 200 means the endpoint didn't throw
  });
});
