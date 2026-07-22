import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTokenValid,
  needsRefresh,
  normalizeApiUrl,
  parseChunkedCookies,
  normalizeUser,
  getStoredAuth,
  storeAuth,
  clearAuth,
  fetchSessionFromServer,
  doRefreshToken,
  buildAuthStatus,
  isAuthError,
  checkUsageLimit,
  logUsageData,
  filterAcceptedExamples,
  getAletheiaRequestHeaders,
  ALETHEIA_API_VERSION,
  AUTH_STORAGE_KEY,
} from "./auth-core.js";

describe("getAletheiaRequestHeaders", () => {
  it("adds API and installed extension versions without dropping caller headers", () => {
    expect(
      getAletheiaRequestHeaders("1.0.3", {
        Authorization: "Bearer token",
      }),
    ).toEqual({
      Authorization: "Bearer token",
      "X-Extension-Source": "aletheia-extension",
      "X-Aletheia-API-Version": ALETHEIA_API_VERSION,
      "X-Aletheia-Extension-Version": "1.0.3",
    });
  });
});

// ─── normalizeApiUrl ───

describe("normalizeApiUrl", () => {
  it("trims whitespace and trailing slashes", () => {
    expect(normalizeApiUrl(" https://www.aletheia.live/// ")).toBe(
      "https://www.aletheia.live",
    );
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeApiUrl(undefined)).toBe("");
  });

  it("preserves a protocol marker while a custom URL is being typed", () => {
    expect(normalizeApiUrl("https://")).toBe("https://");
  });
});

// ─── isTokenValid ───

describe("isTokenValid", () => {
  it("returns false for null/undefined auth", () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid(undefined)).toBe(false);
  });

  it("returns false for auth without access_token", () => {
    expect(isTokenValid({ expires_at: 9999999999 })).toBe(false);
  });

  it("returns false for auth without expires_at", () => {
    expect(isTokenValid({ access_token: "tok" })).toBe(false);
  });

  it("returns true when expires_at is in the future", () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
    expect(
      isTokenValid({ access_token: "tok", expires_at: futureTimestamp }),
    ).toBe(true);
  });

  it("returns false when expires_at is in the past", () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 60;
    expect(
      isTokenValid({ access_token: "tok", expires_at: pastTimestamp }),
    ).toBe(false);
  });

  it("returns false when expires_at equals now (boundary)", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(isTokenValid({ access_token: "tok", expires_at: nowSec })).toBe(
      false,
    );
  });
});

// ─── needsRefresh ───

describe("needsRefresh", () => {
  it("returns true for null auth", () => {
    expect(needsRefresh(null)).toBe(true);
  });

  it("returns true when no expires_at", () => {
    expect(needsRefresh({ access_token: "tok" })).toBe(true);
  });

  it("returns true when token expires within 5-min buffer", () => {
    const expiresInMs = Date.now() + 2 * 60 * 1000; // 2 min from now
    const expiresAt = Math.floor(expiresInMs / 1000);
    expect(needsRefresh({ expires_at: expiresAt })).toBe(true);
  });

  it("returns false when token has > 5 min remaining", () => {
    const expiresInMs = Date.now() + 10 * 60 * 1000; // 10 min from now
    const expiresAt = Math.floor(expiresInMs / 1000);
    expect(needsRefresh({ expires_at: expiresAt })).toBe(false);
  });

  it("respects custom bufferMs", () => {
    const expiresInMs = Date.now() + 2 * 60 * 1000; // 2 min from now
    const expiresAt = Math.floor(expiresInMs / 1000);
    // With 1-min buffer, 2 min remaining = no refresh needed
    expect(needsRefresh({ expires_at: expiresAt }, 60_000)).toBe(false);
    // With 3-min buffer, 2 min remaining = refresh needed
    expect(needsRefresh({ expires_at: expiresAt }, 180_000)).toBe(true);
  });
});

// ─── parseChunkedCookies ───

describe("parseChunkedCookies", () => {
  it("returns null for empty array", () => {
    expect(parseChunkedCookies([])).toBeNull();
  });

  it("returns null for non-auth cookies", () => {
    expect(
      parseChunkedCookies([{ name: "other-cookie", value: "foo" }]),
    ).toBeNull();
  });

  it("parses single base cookie (URL-encoded JSON)", () => {
    const session = { access_token: "tok123", refresh_token: "ref456" };
    const encoded = encodeURIComponent(JSON.stringify(session));
    const result = parseChunkedCookies([
      { name: "sb-xyz-auth-token", value: encoded },
    ]);
    expect(result).toEqual(session);
  });

  it("parses base64-encoded cookie", () => {
    const session = { access_token: "tok123" };
    const encoded = btoa(JSON.stringify(session));
    const result = parseChunkedCookies([
      { name: "sb-xyz-auth-token", value: encoded },
    ]);
    expect(result).toEqual(session);
  });

  it("reassembles chunked cookies in sort order", () => {
    const session = { access_token: "tok-chunked" };
    const fullValue = encodeURIComponent(JSON.stringify(session));
    const mid = Math.floor(fullValue.length / 2);

    const result = parseChunkedCookies([
      { name: "sb-xyz-auth-token.1", value: fullValue.slice(mid) },
      { name: "sb-xyz-auth-token.0", value: fullValue.slice(0, mid) },
    ]);
    expect(result).toEqual(session);
  });

  it("returns null for unparseable cookie value", () => {
    const result = parseChunkedCookies([
      { name: "sb-xyz-auth-token", value: "not-json-or-base64!!!" },
    ]);
    expect(result).toBeNull();
  });

  it("parses base64- prefixed value (modern @supabase/ssr v0.5+ format)", () => {
    const session = { access_token: "tok-ssr5", refresh_token: "ref-ssr5" };
    const value = "base64-" + btoa(JSON.stringify(session));
    const result = parseChunkedCookies([{ name: "sb-xyz-auth-token", value }]);
    expect(result).toEqual(session);
  });

  it("reassembles chunked base64- prefixed cookies in numeric order", () => {
    const session = {
      access_token: "tok-chunked-ssr5",
      refresh_token: "ref-chunked-ssr5",
      user: { id: "u1", email: "x@y.com" },
    };
    const fullValue = "base64-" + btoa(JSON.stringify(session));
    const mid = Math.floor(fullValue.length / 2);

    const result = parseChunkedCookies([
      { name: "sb-xyz-auth-token.1", value: fullValue.slice(mid) },
      { name: "sb-xyz-auth-token.0", value: fullValue.slice(0, mid) },
    ]);
    expect(result).toEqual(session);
  });

  it("ignores PKCE code-verifier cookies (sb-<ref>-auth-token-code-verifier)", () => {
    // Code-verifier value is a plain random string — not JSON, not base64.
    // Including it sent the parser to its noisy final fallback.
    const result = parseChunkedCookies([
      {
        name: "sb-xyz-auth-token-code-verifier",
        value: "random-pkce-verifier-string-abcdef",
      },
    ]);
    expect(result).toBeNull();
  });

  it("parses real session even when code-verifier cookie is present", () => {
    const session = { access_token: "real-session", refresh_token: "rt" };
    const value = "base64-" + btoa(JSON.stringify(session));
    const result = parseChunkedCookies([
      { name: "sb-xyz-auth-token-code-verifier", value: "pkce-noise" },
      { name: "sb-xyz-auth-token", value },
    ]);
    expect(result).toEqual(session);
  });

  it("sorts chunks numerically not lexicographically (handles .10 correctly)", () => {
    // Lexicographic sort would put .10 before .2 — must use numeric.
    const session = { access_token: "tok-many-chunks" };
    const fullValue = "base64-" + btoa(JSON.stringify(session));
    const chunkSize = Math.ceil(fullValue.length / 11);
    const chunks: Array<{ name: string; value: string }> = [];
    for (let i = 0; i < 11; i++) {
      chunks.push({
        name: `sb-xyz-auth-token.${i}`,
        value: fullValue.slice(i * chunkSize, (i + 1) * chunkSize),
      });
    }
    // Shuffle the input order — parser must reorder by .N
    const shuffled = [
      chunks[10],
      chunks[1],
      chunks[0],
      chunks[2],
      ...chunks.slice(3, 10),
    ];
    expect(parseChunkedCookies(shuffled)).toEqual(session);
  });
});

// ─── normalizeUser ───

describe("normalizeUser", () => {
  it("returns null for null input", () => {
    expect(normalizeUser(null)).toBeNull();
  });

  it("extracts full_name from user_metadata", () => {
    const user = {
      id: "1",
      email: "a@b.com",
      user_metadata: { full_name: "Jane Doe" },
    };
    expect(normalizeUser(user)).toEqual({
      id: "1",
      email: "a@b.com",
      full_name: "Jane Doe",
    });
  });

  it("falls back to email prefix when no full_name", () => {
    const user = { id: "1", email: "jane@example.com" };
    expect(normalizeUser(user)).toEqual({
      id: "1",
      email: "jane@example.com",
      full_name: "jane",
    });
  });
});

// ─── Storage helpers ───

describe("storage helpers", () => {
  let storage: any;

  beforeEach(() => {
    storage = chrome.storage.local;
    vi.clearAllMocks();
    Object.keys(storage._store).forEach((k) => delete storage._store[k]);
  });

  it("getStoredAuth returns null when empty", async () => {
    const result = await getStoredAuth(storage);
    expect(result).toBeNull();
  });

  it("storeAuth persists and getStoredAuth retrieves", async () => {
    const authData = {
      access_token: "tok",
      refresh_token: "ref",
      expires_at: 123,
      user: { email: "a@b.com" },
      supabase_url: "url",
      supabase_anon_key: "key",
    };
    await storeAuth(storage, authData);
    const result = await getStoredAuth(storage);
    expect(result.access_token).toBe("tok");
    expect(result.stored_at).toBeDefined();
  });

  it("clearAuth removes stored auth", async () => {
    storage._store[AUTH_STORAGE_KEY] = { access_token: "tok" };
    await clearAuth(storage);
    const result = await getStoredAuth(storage);
    expect(result).toBeNull();
  });
});

// ─── fetchSessionFromServer ───

describe("fetchSessionFromServer", () => {
  it("returns session data on 200", async () => {
    const sessionData = {
      access_token: "tok",
      refresh_token: "ref",
      expires_at: 999,
      user: { email: "a@b.com" },
      supabase_url: "url",
      supabase_anon_key: "key",
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sessionData),
    });

    const result = await fetchSessionFromServer("https://app.com", fetcher);
    expect(result.access_token).toBe("tok");
    expect(fetcher).toHaveBeenCalledWith(
      "https://app.com/api/extension/session",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("normalizes trailing slash before building the session endpoint URL", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "tok",
          expires_at: 999,
        }),
    });

    await fetchSessionFromServer("https://app.com/", fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "https://app.com/api/extension/session",
      expect.any(Object),
    );
  });

  it("throws on non-200 with status", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: { get: () => null },
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    await expect(
      fetchSessionFromServer("https://app.com", fetcher),
    ).rejects.toThrow("Unauthorized");
  });

  it("throws when response missing access_token", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: {} }),
    });

    await expect(
      fetchSessionFromServer("https://app.com", fetcher),
    ).rejects.toThrow("access_token");
  });
});

// ─── doRefreshToken ───

describe("doRefreshToken", () => {
  it("returns updated auth on success", async () => {
    const auth = {
      access_token: "old",
      refresh_token: "ref",
      supabase_url: "https://sb.com",
      supabase_anon_key: "key",
      user: { id: "1", email: "a@b.com" },
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-tok",
          refresh_token: "new-ref",
          expires_at: 9999,
          user: {
            id: "1",
            email: "a@b.com",
            user_metadata: { full_name: "Jane" },
          },
        }),
    });

    const result = await doRefreshToken(auth, fetcher);
    expect(result.access_token).toBe("new-tok");
    expect(result.refresh_token).toBe("new-ref");
    expect(result.user.full_name).toBe("Jane");
  });

  it("throws with shouldClearAuth on 401", async () => {
    const auth = {
      refresh_token: "ref",
      supabase_url: "https://sb.com",
      supabase_anon_key: "key",
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("expired"),
    });

    try {
      await doRefreshToken(auth, fetcher);
      expect.fail("should throw");
    } catch (err: any) {
      expect(err.shouldClearAuth).toBe(true);
    }
  });

  it("throws when missing refresh credentials", async () => {
    await expect(doRefreshToken({}, vi.fn())).rejects.toThrow(
      "Missing refresh credentials",
    );
  });
});

// ─── buildAuthStatus ───

describe("buildAuthStatus", () => {
  it("returns not authenticated for null", () => {
    expect(buildAuthStatus(null)).toEqual({ authenticated: false });
  });

  it("returns authenticated true for valid token", () => {
    const auth = {
      access_token: "tok",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { email: "a@b.com" },
    };
    const status = buildAuthStatus(auth);
    expect(status.authenticated).toBe(true);
    expect(status.user.email).toBe("a@b.com");
  });
});

// ─── isAuthError ───

describe("isAuthError", () => {
  it("detects 401 messages", () => {
    expect(isAuthError("HTTP 401: Unauthorized")).toBe(true);
  });

  it('detects "Not authenticated"', () => {
    expect(isAuthError("Not authenticated")).toBe(true);
  });

  it("returns false for non-auth errors", () => {
    expect(isAuthError("Network error")).toBe(false);
    expect(isAuthError("Rate limit exceeded")).toBe(false);
  });
});

// ─── checkUsageLimit ───

describe("checkUsageLimit", () => {
  it("does not throw when under limit", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(() =>
      checkUsageLimit({ [today]: 5 }, { maxDailyUsage: 50 }),
    ).not.toThrow();
  });

  it("throws when at limit", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(() =>
      checkUsageLimit({ [today]: 50 }, { maxDailyUsage: 50 }),
    ).toThrow("Daily usage limit");
  });

  it("defaults to 50 when maxDailyUsage not set", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(() => checkUsageLimit({ [today]: 49 }, {})).not.toThrow();
    expect(() => checkUsageLimit({ [today]: 50 }, {})).toThrow();
  });
});

// ─── logUsageData ───

describe("logUsageData", () => {
  it("increments daily and category usage", () => {
    const today = new Date().toISOString().split("T")[0];
    const result = logUsageData({}, {}, "linkedin_connection");
    expect(result.dailyUsage[today]).toBe(1);
    expect(result.categoryUsage[today].linkedin_connection).toBe(1);
  });

  it("accumulates across calls", () => {
    const today = new Date().toISOString().split("T")[0];
    const daily = { [today]: 3 };
    const cat = { [today]: { cold_email: 2 } };
    const result = logUsageData(daily, cat, "cold_email");
    expect(result.dailyUsage[today]).toBe(4);
    expect(result.categoryUsage[today].cold_email).toBe(3);
  });

  it("cleans up entries older than 30 days", () => {
    const oldDate = "2020-01-01";
    const today = new Date().toISOString().split("T")[0];
    const daily = { [oldDate]: 5, [today]: 1 };
    const result = logUsageData(daily, {}, "linkedin_connection");
    expect(result.dailyUsage[oldDate]).toBeUndefined();
    expect(result.dailyUsage[today]).toBe(2);
  });
});

// ─── filterAcceptedExamples ───

describe("filterAcceptedExamples", () => {
  const accepted = [
    { category: "linkedin_connection", body: "msg1" },
    { category: "cold_email", body: "email1" },
    { category: "linkedin_connection", body: "msg2" },
    { category: "linkedin_connection", body: "msg3" },
    { category: "linkedin_connection", message: "msg4" },
  ];

  it("filters by category and returns bodies", () => {
    const result = filterAcceptedExamples(accepted, "cold_email");
    expect(result).toEqual(["email1"]);
  });

  it("returns last N matching examples", () => {
    const result = filterAcceptedExamples(accepted, "linkedin_connection", 2);
    expect(result).toHaveLength(2);
  });

  it("falls back to message field when body missing", () => {
    const result = filterAcceptedExamples(accepted, "linkedin_connection", 10);
    expect(result).toContain("msg4");
  });

  it("returns empty for no matches", () => {
    expect(filterAcceptedExamples(accepted, "linkedin_inmail")).toEqual([]);
  });
});
