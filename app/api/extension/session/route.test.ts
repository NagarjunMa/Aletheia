import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { getCorsHeaders } from "@/lib/cors";

const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";

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
  process.env.CHROME_EXTENSION_ID = EXTENSION_ID;
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

afterEach(() => {
  delete process.env.CHROME_EXTENSION_ID;
  delete process.env.CHROME_EXTENSION_IDS;
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

    it("sets Access-Control-Allow-Credentials: true for the configured chrome-extension origin", async () => {
      // Without this header, the SW fetch (credentials: 'include') has
      // its cookies stripped by the browser, the route sees no session,
      // and returns 401. Regression guard for Bug 3.
      const res = await GET(
        makeRequest({ origin: `chrome-extension://${EXTENSION_ID}` }),
      );
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        `chrome-extension://${EXTENSION_ID}`,
      );
    });

    it("returns 403 for an unconfigured chrome-extension origin", async () => {
      const res = await GET(
        makeRequest({
          origin: "chrome-extension://badbadbadbadbadbadbadbadbadbadba",
        }),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Origin not allowed");
    });

    it("returns 403 for null-origin requests without the extension source header", async () => {
      // Regression guard: a null-origin request with no identifying header
      // must still be rejected. This is what keeps the fix from reopening
      // the old wildcard CORS bypass.
      const res = await GET(makeRequest({ origin: null }));

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
    it("returns 200 with user info for web origin but no bearer tokens", async () => {
      // Web origin uses Supabase SSR cookies and never needs bearer tokens in
      // a JSON response body. This keeps XSS blast radius smaller.
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.access_token).toBeUndefined();
      expect(body.refresh_token).toBeUndefined();
      expect(body.user.id).toBe("test-user-id");
      expect(body.user.full_name).toBe("Test User");
      expect(body.supabase_url).toBeUndefined();
      expect(body.supabase_anon_key).toBeUndefined();
    });

    it("returns tokens to the configured chrome-extension:// origin", async () => {
      // Browser-enforced Origin header — same-origin XSS on aletheia.live
      // cannot spoof the configured chrome-extension://<id>. Safe to ship refresh_token
      // back to the extension service worker.
      const res = await GET(
        makeRequest({ origin: `chrome-extension://${EXTENSION_ID}` }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.access_token).toBe("test-access");
      expect(body.refresh_token).toBe("test-refresh");
      expect(body.supabase_url).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
      expect(body.supabase_anon_key).toBe(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );
    });

    it("returns tokens for null-origin requests carrying the extension source header", async () => {
      // Chrome never attaches Origin to fetches covered by the extension's
      // host_permissions — this is the actual path the shipped extension
      // uses. X-Extension-Source is the only identity signal available.
      const res = await GET(
        makeRequest({
          origin: null,
          headers: { "X-Extension-Source": "aletheia-extension" },
        }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.access_token).toBe("test-access");
      expect(body.refresh_token).toBe("test-refresh");
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

  it("preflight carries Access-Control-Allow-Credentials: true for chrome-extension", async () => {
    // Preflight must mirror the credential header the actual GET will
    // carry, or the browser fails the preflight and never sends GET.
    const res = await OPTIONS(
      makeRequest({
        method: "OPTIONS",
        origin: `chrome-extension://${EXTENSION_ID}`,
      }),
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      `chrome-extension://${EXTENSION_ID}`,
    );
  });
});
