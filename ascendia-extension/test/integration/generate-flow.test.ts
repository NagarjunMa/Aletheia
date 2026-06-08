import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTokenValid,
  needsRefresh,
  getStoredAuth,
  storeAuth,
  clearAuth,
  buildAuthStatus,
  fetchSessionFromServer,
  doRefreshToken,
  isAuthError,
  checkUsageLimit,
  logUsageData,
  filterAcceptedExamples,
} from "../../background/auth-core.js";
import {
  buildGeneratePayload,
  parseGenerationResponse,
} from "../../popup/popup-core.js";

// ─── Full generate flow integration tests ───
// These test the logical flow across multiple modules without chrome.* wiring.

describe("generate flow integration", () => {
  let storage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = chrome.storage.local;
    Object.keys(storage._store).forEach(
      (k: string) => delete storage._store[k],
    );
  });

  it("full happy path: valid token → build payload → parse response", async () => {
    // 1. Store valid auth
    await storeAuth(storage, {
      access_token: "valid-tok",
      refresh_token: "ref",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { email: "user@test.com" },
      supabase_url: "https://sb.com",
      supabase_anon_key: "key",
    });

    // 2. Verify token is valid
    const auth = await getStoredAuth(storage);
    expect(isTokenValid(auth)).toBe(true);
    expect(needsRefresh(auth)).toBe(false);

    // 3. Build payload
    const profile = {
      profileMarkdown: "Jane is a senior engineer...".repeat(10),
      profileUrl: "https://linkedin.com/in/jane",
    };
    const accepted = [
      { category: "linkedin_connection", body: "Hi Jane, loved your post!" },
      { category: "cold_email", body: "email msg" },
    ];
    const examples = filterAcceptedExamples(accepted, "linkedin_connection");
    expect(examples).toEqual(["Hi Jane, loved your post!"]);

    const payload = buildGeneratePayload(
      profile,
      "resume",
      "JD text",
      "linkedin_connection",
      "networking",
      examples,
    );
    expect(payload.profileMarkdown).toContain("Jane");
    expect(payload.acceptedExamples).toHaveLength(1);

    // 4. Parse response
    const apiResponse = {
      body: "Great connecting with you, Jane!",
      category: "linkedin_connection",
      authenticityScore: 88,
    };
    const parsed = parseGenerationResponse(apiResponse);
    expect(parsed.body).toBe("Great connecting with you, Jane!");
  });

  it("cold email flow: JSON response parsed correctly", async () => {
    const apiResponse = {
      body: '```json\n{"subject_line": "Quick question", "body": "Hi Jane..."}\n```',
      category: "cold_email",
    };
    const parsed = parseGenerationResponse(apiResponse);
    expect(parsed.subject_line).toBe("Quick question");
    expect(parsed.body).toBe("Hi Jane...");
  });

  it("expired token triggers refresh path", async () => {
    // Store expired auth
    await storeAuth(storage, {
      access_token: "expired-tok",
      refresh_token: "ref",
      expires_at: Math.floor(Date.now() / 1000) - 60, // expired 1 min ago
      user: { email: "user@test.com" },
      supabase_url: "https://sb.com",
      supabase_anon_key: "key",
    });

    const auth = await getStoredAuth(storage);
    expect(isTokenValid(auth)).toBe(false);

    // Auth status should show not authenticated
    const status = buildAuthStatus(auth);
    expect(status.authenticated).toBe(false);

    // Refresh should be called — simulate successful refresh
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "fresh-tok",
          refresh_token: "fresh-ref",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
    });

    const refreshed = await doRefreshToken(auth, fetcher);
    expect(refreshed.access_token).toBe("fresh-tok");

    // Store and verify
    await storeAuth(storage, refreshed);
    const newAuth = await getStoredAuth(storage);
    expect(isTokenValid(newAuth)).toBe(true);
  });

  it("usage limit blocks generation when exceeded", async () => {
    const today = new Date().toISOString().split("T")[0];
    const dailyUsage = { [today]: 50 };
    const settings = { maxDailyUsage: 50 };

    expect(() => checkUsageLimit(dailyUsage, settings)).toThrow(
      "Daily usage limit",
    );
  });

  it("usage logging increments and cleans old data", () => {
    const today = new Date().toISOString().split("T")[0];
    const oldDate = "2020-01-15";
    const dailyUsage = { [today]: 2, [oldDate]: 10 };
    const categoryUsage = { [oldDate]: { cold_email: 10 } };

    const result = logUsageData(
      dailyUsage,
      categoryUsage,
      "linkedin_connection",
    );
    expect(result.dailyUsage[today]).toBe(3);
    expect(result.dailyUsage[oldDate]).toBeUndefined(); // cleaned
    expect(result.categoryUsage[oldDate]).toBeUndefined(); // cleaned
    expect(result.categoryUsage[today].linkedin_connection).toBe(1);
  });

  it("auth error detection works across modules", () => {
    expect(isAuthError("HTTP 401: Unauthorized")).toBe(true);
    expect(isAuthError("Not authenticated")).toBe(true);
    expect(isAuthError("Session expired")).toBe(true);
    expect(isAuthError("Rate limit exceeded")).toBe(false);
    expect(isAuthError("Network error")).toBe(false);
  });

  it("session fetch → store → status roundtrip", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-tok",
          refresh_token: "new-ref",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: "1", email: "jane@test.com" },
          supabase_url: "https://sb.com",
          supabase_anon_key: "key",
        }),
    });

    const session = await fetchSessionFromServer("https://app.com", fetcher);
    await storeAuth(storage, session);

    const stored = await getStoredAuth(storage);
    const status = buildAuthStatus(stored);
    expect(status.authenticated).toBe(true);
    expect(status.user.email).toBe("jane@test.com");
  });

  it("clearAuth → status shows unauthenticated", async () => {
    await storeAuth(storage, {
      access_token: "tok",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { email: "a@b.com" },
    });

    await clearAuth(storage);
    const auth = await getStoredAuth(storage);
    const status = buildAuthStatus(auth);
    expect(status.authenticated).toBe(false);
  });
});
