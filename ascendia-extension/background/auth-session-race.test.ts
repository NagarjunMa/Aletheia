import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuth,
  recoverGenerationSession,
  getAuthSnapshot,
  getAuthStatus,
  getValidAccessToken,
  proactiveRefresh,
  restorePopupSession,
  storeAuth,
  waitForLogin,
} from "./auth.js";
import { generateWithAuthRecovery } from "./generate-auth-recovery.js";

const api = "https://extension.test";
const issuer = "https://issuer.test";
const key = "aletheia_auth";

function session(id: string, expired = false) {
  return {
    user: { id },
    access_token: "synthetic-access-" + id,
    refresh_token: "synthetic-refresh-" + id,
    expires_at: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    supabase_url: issuer,
    supabase_anon_key: "synthetic-key",
  };
}

function holdResponse() {
  return {
    started: Promise.withResolvers<void>(),
    response: Promise.withResolvers<Response>(),
  };
}

describe("extension auth account transitions", () => {
  let current: ReturnType<typeof session> | undefined;
  let holdRead: (() => Promise<void>) | undefined;
  let writes: string[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    current = session("A", true);
    holdRead = undefined;
    writes = [];
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("chrome", {
      runtime: { getManifest: () => ({ version: "1.0.22" }) },
      alarms: { clear: async () => true },
      tabs: {
        query: async () => [{ id: 15 }],
        update: async () => undefined,
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      cookies: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
      storage: {
        local: {
          get: async () => {
            const captured = structuredClone(current);
            const pending = holdRead;
            holdRead = undefined;
            await pending?.();
            return captured ? { [key]: captured } : {};
          },
          set: async (data: Record<string, ReturnType<typeof session>>) => {
            if (!data[key]) return;
            current = structuredClone(data[key]);
            writes.push("store:" + current.user.id);
          },
          remove: async (keys: string | string[]) => {
            if (!keys.includes(key)) return;
            writes.push("clear:" + current?.user.id);
            current = undefined;
          },
        },
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ends automatic generation on a stale refresh without touching the new session", async () => {
    const refresh = holdResponse();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith(issuer)) {
        refresh.started.resolve();
        return refresh.response.promise;
      }
      return Response.json({}, { status: 401 });
    });
    const generate = vi.fn();
    const recoverSilently = vi.fn(() => recoverGenerationSession(api));
    const operation = generateWithAuthRecovery({
      getAccessToken: () =>
        getValidAccessToken(api, { allowSessionFetch: false }),
      generate,
      recoverSilently,
      clearAuth,
      authenticateInteractively: vi.fn(),
    });
    const result = expect(operation).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_CHANGED",
    });
    await refresh.started.promise;
    await storeAuth(session("B"));
    refresh.response.resolve(Response.json(session("A")));
    await result;
    expect(recoverSilently).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(writes).toEqual(["store:B"]);
  });

  it.each([
    ["proactive", proactiveRefresh, 200],
    ["proactive rejection", proactiveRefresh, 401],
    ["token acquisition", getValidAccessToken, 200],
  ] as const)(
    "preserves the new account during %s web fallback",
    async (_name, recover, status) => {
      const web = holdResponse();
      fetchMock.mockImplementation(async (url: string) => {
        if (url.startsWith(issuer)) return Response.json({}, { status: 503 });
        expect(url).toBe(api + "/api/extension/session");
        web.started.resolve();
        return web.response.promise;
      });
      const operation = recover(api);
      const result =
        recover === getValidAccessToken
          ? expect(operation).rejects.toMatchObject({
              code: "AUTH_ACCOUNT_CHANGED",
            })
          : expect(operation).resolves.toBeUndefined();
      await web.started.promise;
      await storeAuth(session("B"));
      web.response.resolve(
        Response.json(
          status === 200
            ? session("A")
            : {
                code: "SESSION_REFRESH_REJECTED",
              },
          { status },
        ),
      );
      await result;
      expect(writes).toEqual(["store:B"]);
    },
  );

  it("orders the refresh comparison and write before a queued account switch", async () => {
    const refresh = holdResponse();
    fetchMock.mockImplementation(() => {
      refresh.started.resolve();
      return refresh.response.promise;
    });
    const operation = getValidAccessToken(api, { allowSessionFetch: false });
    await refresh.started.promise;
    const reading = Promise.withResolvers<void>();
    const resumeRead = Promise.withResolvers<void>();
    holdRead = async () => {
      reading.resolve();
      await resumeRead.promise;
    };
    refresh.response.resolve(Response.json(session("A")));
    await reading.promise;
    const switchAccount = storeAuth(session("B"));
    // Allow an unqueued write to finish before releasing the captured storage read.
    await Promise.resolve();
    resumeRead.resolve();
    await Promise.all([operation, switchAccount]);
    expect(current?.user.id).toBe("B");
  });

  it("shares a rejected token refresh while allowing popup startup to recover through the web session", async () => {
    const refresh = holdResponse();
    const web = holdResponse();
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith(issuer)) {
        refresh.started.resolve();
        return refresh.response.promise;
      }
      web.started.resolve();
      return web.response.promise;
    });
    const proactive = proactiveRefresh(api);
    await refresh.started.promise;
    const popup = restorePopupSession(api, undefined, await getAuthSnapshot());
    const results = Promise.allSettled([proactive, popup]);
    refresh.response.resolve(Response.json({}, { status: 401 }));
    await web.started.promise;
    expect(writes).toEqual([]);
    web.response.resolve(Response.json(session("A")));
    expect(await results).toEqual([
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ]);
    await expect(getAuthStatus()).resolves.toMatchObject({
      authenticated: true,
      user: { id: "A" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(writes).toEqual(["store:A"]);
  });

  it("rejects a web session for a different owner when reconnecting a generation", async () => {
    fetchMock.mockResolvedValue(Response.json(session("B")));
    await expect(
      recoverGenerationSession(api, undefined, await getAuthSnapshot(), "A"),
    ).rejects.toMatchObject({ code: "AUTH_ACCOUNT_CHANGED" });
    expect(writes).toEqual([]);
  });

  it("discards a web session that finishes after logout from empty storage", async () => {
    current = undefined;
    const web = holdResponse();
    fetchMock.mockImplementation(() => {
      web.started.resolve();
      return web.response.promise;
    });
    const operation = restorePopupSession(
      api,
      undefined,
      await getAuthSnapshot(),
    );
    const result = expect(operation).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_CHANGED",
    });
    await web.started.promise;
    await clearAuth();
    web.response.resolve(Response.json(session("A")));
    await result;
    expect(current).toBeUndefined();
  });

  it("cancels a pending interactive login when the user logs out", async () => {
    const pollingStarted = Promise.withResolvers<void>();
    const alarm = vi.fn(() => pollingStarted.resolve());
    Object.assign(chrome.alarms, { create: alarm });
    const operation = waitForLogin(api);
    const result = expect(operation).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_CHANGED",
    });
    await pollingStarted.promise;
    await clearAuth();
    await result;
    expect(chrome.cookies.onChanged.removeListener).toHaveBeenCalledOnce();
    expect(chrome.tabs.onUpdated.removeListener).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(current).toBeUndefined();
  });

  it("does not rebase a pending login onto an account connected after it started", async () => {
    vi.useFakeTimers();
    try {
      current = undefined;
      fetchMock.mockResolvedValue(Response.json(session("A")));
      const pollingStarted = Promise.withResolvers<void>();
      Object.assign(chrome.alarms, { create: () => pollingStarted.resolve() });
      const operation = waitForLogin(api);
      const result = expect(operation).rejects.toMatchObject({
        code: "AUTH_ACCOUNT_CHANGED",
      });
      await pollingStarted.promise;
      await storeAuth(session("B"));
      await vi.advanceTimersByTimeAsync(3000);
      await result;
      expect(writes).toEqual(["store:B"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not replace stored credentials with an expired web token during startup", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith(issuer)
        ? Response.json({}, { status: 503 })
        : Response.json({
            ...session("A", true),
            refresh_token: "older-cookie",
          }),
    );
    await expect(
      restorePopupSession(api, undefined, await getAuthSnapshot()),
    ).rejects.toMatchObject({ code: "SESSION_UNAVAILABLE" });
    expect(writes).toEqual([]);
    expect(current?.refresh_token).toBe("synthetic-refresh-A");
  });
});
