import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

// ─── Hoisted mock functions ───────────────────────────────────────────────────
// vi.hoisted ensures these are available inside vi.mock() factories,
// which are executed before the rest of the test file.
const mockBearerGetUser = vi.hoisted(() => vi.fn());
const mockCookieGetUser = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────
// @/lib/supabase/server: provides cookie-bound client + cookie-less Bearer
// helpers used by the route after the service-role refactor.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockCookieGetUser },
  })),
  createBearerAuthClient: vi.fn(() => ({
    auth: { getUser: mockBearerGetUser },
  })),
  createBearerServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── Route handler ────────────────────────────────────────────────────────────
import { GET, OPTIONS } from "./route";

// ─── Test fixtures ────────────────────────────────────────────────────────────
const MOCK_USER = {
  id: "test-user-uuid-1234",
  email: "user@example.com",
  user_metadata: { full_name: "Jane Doe" },
};

const VALID_TOKEN = "valid-test-jwt-abc";

function successAuth() {
  return { data: { user: MOCK_USER }, error: null };
}

function failAuth() {
  return { data: { user: null }, error: { message: "Invalid JWT" } };
}

function noAuth() {
  return { data: { user: null }, error: null };
}

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  // Reset call history + implementations for leaf functions
  mockBearerGetUser.mockReset();
  mockCookieGetUser.mockReset();
  mockSingle.mockReset();

  // Re-establish the rate limit query chain: from().select().eq().single()
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("GET /api/auth/me", () => {
  describe("authentication — Bearer token", () => {
    it("returns 401 when Authorization header is absent", async () => {
      mockCookieGetUser.mockResolvedValue(noAuth());

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.authenticated).toBe(false);
    });

    it("returns 401 when Bearer token is invalid and cookie fallback also fails", async () => {
      mockBearerGetUser.mockResolvedValue(failAuth());
      mockCookieGetUser.mockResolvedValue(noAuth());

      const res = await GET(makeRequest({ bearerToken: "bad-token" }));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.authenticated).toBe(false);
    });

    it("returns 200 and user data when Bearer token is valid", async () => {
      mockBearerGetUser.mockResolvedValue(successAuth());
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "not found" },
      });

      const res = await GET(makeRequest({ bearerToken: VALID_TOKEN }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.authenticated).toBe(true);
      expect(body.user.id).toBe(MOCK_USER.id);
      expect(body.user.email).toBe(MOCK_USER.email);
      expect(body.user.full_name).toBe("Jane Doe");
    });
  });

  describe("authentication — cookie fallback", () => {
    it("falls back to cookie auth when Bearer token fails", async () => {
      mockBearerGetUser.mockResolvedValue(failAuth());
      mockCookieGetUser.mockResolvedValue(successAuth());
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "no usage row" },
      });

      const res = await GET(makeRequest({ bearerToken: "bad-token" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.authenticated).toBe(true);
      expect(body.user.id).toBe(MOCK_USER.id);
    });

    it("falls back to cookie auth when no Bearer header is provided", async () => {
      mockCookieGetUser.mockResolvedValue(successAuth());
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "no usage row" },
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.authenticated).toBe(true);
    });
  });

  describe("rate limit window logic — getUsage()", () => {
    beforeEach(() => {
      // Auth always succeeds for rate limit tests
      mockBearerGetUser.mockResolvedValue(successAuth());
    });

    it("returns actual request_count when window_start is recent (< 24h ago)", async () => {
      const recentWindowStart = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString(); // 2h ago
      mockSingle.mockResolvedValue({
        data: { request_count: 12, window_start: recentWindowStart },
        error: null,
      });

      const res = await GET(makeRequest({ bearerToken: VALID_TOKEN }));
      const body = await res.json();
      expect(body.usage.count).toBe(12);
      expect(body.usage.limit).toBe(30);
    });

    it("resets count to 0 when rate limit window has expired (> 24h ago)", async () => {
      // This is the key business logic: if the window is stale, usage is treated as 0.
      // Cannot be tested via E2E — requires controlling the timestamp.
      const expiredWindowStart = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString(); // 25h ago
      mockSingle.mockResolvedValue({
        data: { request_count: 18, window_start: expiredWindowStart },
        error: null,
      });

      const res = await GET(makeRequest({ bearerToken: VALID_TOKEN }));
      const body = await res.json();
      expect(body.usage.count).toBe(0);
    });

    it("fails open — returns count: 0 when rate limit DB query errors", async () => {
      // Design: a DB error should not block the user. Fail open with 0 usage.
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "connection refused" },
      });

      const res = await GET(makeRequest({ bearerToken: VALID_TOKEN }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.usage.count).toBe(0);
    });

    it("fails open — returns count: 0 when rate limit row does not exist yet", async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const res = await GET(makeRequest({ bearerToken: VALID_TOKEN }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.usage.count).toBe(0);
    });
  });

  describe("response shape", () => {
    it("response always includes authenticated, user, and usage fields", async () => {
      mockBearerGetUser.mockResolvedValue(successAuth());
      mockSingle.mockResolvedValue({ data: null, error: null });

      const res = await GET(makeRequest({ bearerToken: VALID_TOKEN }));
      const body = await res.json();
      expect(body).toHaveProperty("authenticated");
      expect(body).toHaveProperty("user");
      expect(body).toHaveProperty("usage");
      expect(body.usage).toHaveProperty("count");
      expect(body.usage).toHaveProperty("limit");
      expect(body.usage).toHaveProperty("reset_time");
    });
  });
});

describe("OPTIONS /api/auth/me", () => {
  it("returns 200 with CORS headers for preflight", async () => {
    const res = await OPTIONS(makeRequest({ method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain(
      "OPTIONS",
    );
  });
});
