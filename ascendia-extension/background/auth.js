// Aletheia Extension Auth Module
// Manages Supabase session sharing between web app and extension

import {
  createExtensionLogger,
  startExtensionTimedStage,
} from "../lib/logger.js";

const AUTH_STORAGE_KEY = "aletheia_auth";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry
const ALETHEIA_API_VERSION = "1";
const log = createExtensionLogger("auth");

function getSafeErrorCode(error, fallback) {
  return typeof error?.code === "string" && /^[A-Z0-9_]{3,80}$/.test(error.code)
    ? error.code
    : fallback;
}

export function getAletheiaRequestHeaders(additionalHeaders = {}) {
  return {
    ...additionalHeaders,
    "X-Extension-Source": "aletheia-extension",
    "X-Aletheia-API-Version": ALETHEIA_API_VERSION,
    "X-Aletheia-Extension-Version": chrome.runtime.getManifest().version,
  };
}

function normalizeApiUrl(apiUrl) {
  let value = String(apiUrl || "").trim();
  while (value.endsWith("/") && !value.endsWith("://")) {
    value = value.slice(0, -1);
  }
  return value;
}

function createAuthFailure(
  message,
  { code = "AUTH_REQUIRED", status = 401, cause } = {},
) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.authCause = cause || code;
  return error;
}

// ─── Storage helpers ───

async function getStoredAuth() {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return result[AUTH_STORAGE_KEY] || null;
}

let authMutation = Promise.resolve();
let authRevision = 0;

function queueAuthOperation(operation) {
  const pending = authMutation.then(operation);
  authMutation = pending.catch(() => {});
  return pending;
}

export function getAuthSnapshot() {
  return queueAuthOperation(async () => ({
    auth: await getStoredAuth(),
    revision: authRevision,
  }));
}

export function authAccountChanged() {
  return createAuthFailure(
    "The connected account changed. Reopen the extension and try again.",
    {
      code: "AUTH_ACCOUNT_CHANGED",
      status: 409,
    },
  );
}

async function assertAuthSnapshot(expected) {
  const current = await getStoredAuth();
  if (
    expected.revision !== authRevision ||
    current?.user?.id !== expected.auth?.user?.id ||
    current?.access_token !== expected.auth?.access_token ||
    current?.refresh_token !== expected.auth?.refresh_token ||
    current?.stored_at !== expected.auth?.stored_at
  ) {
    throw authAccountChanged();
  }
}

function mutateAuth(expected, write) {
  return queueAuthOperation(async () => {
    if (expected) await assertAuthSnapshot(expected);
    authRevision++;
    await write();
  });
}

export function storeAuth(authData, expected) {
  return mutateAuth(expected, async () => {
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: {
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
        expires_at: authData.expires_at,
        user: authData.user,
        supabase_url: authData.supabase_url,
        supabase_anon_key: authData.supabase_anon_key,
        stored_at: Date.now(),
      },
    });
    log.info("auth.storage.complete", {
      outcome: "success",
      hasUser: Boolean(authData.user),
    });
  });
}

export function clearAuth(expected) {
  return mutateAuth(expected, async () => {
    await chrome.storage.local.remove(
      expected ? AUTH_STORAGE_KEY : [AUTH_STORAGE_KEY, "_loginPending"],
    );
    if (!expected) {
      _loginReject?.(authAccountChanged());
      await chrome.alarms.clear(LOGIN_KEEPALIVE_ALARM);
    }
    log.info("auth.storage.cleared", { outcome: "success" });
  });
}

// ─── Token validation ───

export function isTokenValid(auth) {
  if (!auth || !auth.access_token || !auth.expires_at) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return auth.expires_at > nowSec;
}

function needsRefresh(auth) {
  if (!auth || !auth.expires_at) return true;
  const nowMs = Date.now();
  const expiresMs = auth.expires_at * 1000;
  return expiresMs - nowMs < TOKEN_REFRESH_BUFFER_MS;
}

// ─── Session fetching via server endpoint ───
// Uses /api/extension/session which validates cookies server-side via Supabase proxy.
// This avoids the problem of chrome.cookies.getAll() not seeing Supabase client-side cookies
// (createBrowserClient may store sessions in localStorage or set cookies that the chrome.cookies
// API cannot read due to domain/SameSite/partitioning issues).

const webSessions = new Map();

function fetchSessionFromWebApp(apiUrl, operationId, revision) {
  const baseUrl = normalizeApiUrl(apiUrl);
  const key = JSON.stringify([baseUrl, revision]);
  const existing = webSessions.get(key);
  if (existing) {
    log.info("auth.session.coalesced", { operationId });
    return existing;
  }
  const pending = requestWebSession(baseUrl, operationId).finally(() => {
    webSessions.delete(key);
  });
  webSessions.set(key, pending);
  return pending;
}

async function requestWebSession(baseUrl, operationId) {
  const complete = startExtensionTimedStage(log, "auth.session_exchange", {
    operationId,
  });
  let terminalRecorded = false;
  const finish = (outcome, fields = {}) => {
    if (terminalRecorded) return;
    terminalRecorded = true;
    complete(outcome, fields);
  };

  // Method 1: Server endpoint (reliable — proxy handles cookie validation)
  try {
    const response = await fetch(`${baseUrl}/api/extension/session`, {
      method: "GET",
      credentials: "include",
      headers: getAletheiaRequestHeaders(
        operationId ? { "X-Aletheia-Operation-Id": operationId } : {},
      ),
    });

    if (response.ok) {
      const sessionData = await response.json();

      if (!sessionData.access_token) {
        throw new Error("Server returned session without access_token");
      }

      finish("success", {
        authSource: "session_endpoint",
        status: response.status,
      });
      return {
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        expires_at: sessionData.expires_at,
        user: sessionData.user,
        supabase_url: sessionData.supabase_url,
        supabase_anon_key: sessionData.supabase_anon_key,
      };
    }

    const errorBody = await response.json().catch(() => ({}));
    // Propagate 401 status so callers can apply backoff
    if (response.status === 401) {
      const err = createAuthFailure(
        errorBody.error || "Not authenticated. Please reconnect the extension.",
        {
          code: errorBody.code || "SESSION_UNAVAILABLE",
          status: response.status,
          cause: errorBody.cause,
        },
      );
      err.retryAfter = parseInt(response.headers.get("Retry-After"), 10) || 0;
      throw err;
    }
  } catch (fetchError) {
    // Re-throw 401 errors so callers can apply backoff (don't fall through to cookie fallback)
    if (fetchError.status === 401) {
      finish("failure", {
        errorCode: getSafeErrorCode(fetchError, "SESSION_UNAVAILABLE"),
        status: 401,
      });
      throw fetchError;
    }
    log.info("auth.session.endpoint.complete", {
      operationId,
      outcome: "fallback",
      errorCode: getSafeErrorCode(fetchError, "SESSION_ENDPOINT_UNAVAILABLE"),
    });
  }

  // Method 2: Fallback — read cookies directly via chrome.cookies API
  const cookies = await chrome.cookies.getAll({ url: baseUrl });

  // Match only `sb-<ref>-auth-token` and its `.0`/`.1` chunks. PKCE OAuth
  // verifiers (`sb-<ref>-auth-token-code-verifier`) share the substring
  // but carry a random string, not a session payload.
  const authCookies = cookies.filter((c) =>
    /^sb-[^=]+-auth-token(?:\.\d+)?$/.test(c.name),
  );

  log.info("auth.cookie_lookup.complete", {
    operationId,
    outcome: "success",
    cookieCount: authCookies.length,
  });

  if (authCookies.length === 0) {
    finish("failure", { errorCode: "SESSION_UNAVAILABLE" });
    throw createAuthFailure(
      "No active session found. Please log in to the web app first.",
      { code: "SESSION_UNAVAILABLE" },
    );
  }

  // Reassemble: single cookie or chunked (@supabase/ssr ≥0.5 splits
  // sessions across `sb-<ref>-auth-token.0`, `.1`, ... above ~3180 bytes).
  let rawValue;
  const baseCookie = authCookies.find((c) =>
    /^sb-[^.]+-auth-token$/.test(c.name),
  );
  if (baseCookie) {
    rawValue = baseCookie.value;
  } else {
    const chunks = authCookies
      .filter((c) => /\.\d+$/.test(c.name))
      .sort((a, b) => {
        const ai = parseInt(a.name.split(".").pop(), 10);
        const bi = parseInt(b.name.split(".").pop(), 10);
        return ai - bi;
      });
    rawValue = chunks.map((c) => c.value).join("");
  }

  // Modern @supabase/ssr prefixes the value with literal "base64-".
  let candidate = rawValue;
  try {
    candidate = decodeURIComponent(rawValue);
  } catch (e) {
    /* not URL-encoded */
  }

  let session = null;
  if (candidate.startsWith("base64-")) {
    try {
      session = JSON.parse(atob(candidate.slice(7)));
    } catch (e) {
      finish("failure", { errorCode: "SESSION_COOKIE_INVALID" });
      throw createAuthFailure(
        "Could not read the web-app session. Please log in again.",
        { code: "SESSION_COOKIE_INVALID" },
      );
    }
  } else {
    try {
      session = JSON.parse(candidate);
    } catch (e) {
      try {
        session = JSON.parse(atob(candidate));
      } catch (e2) {
        finish("failure", { errorCode: "SESSION_COOKIE_INVALID" });
        throw createAuthFailure(
          "Could not read the web-app session. Please log in again.",
          { code: "SESSION_COOKIE_INVALID" },
        );
      }
    }
  }

  if (!session || !session.access_token) {
    finish("failure", { errorCode: "SESSION_COOKIE_INVALID" });
    throw createAuthFailure(
      "Could not read the web-app session. Please log in again.",
      { code: "SESSION_COOKIE_INVALID" },
    );
  }

  // Fetch Supabase config for token refresh
  let supabaseUrl, supabaseAnonKey;
  try {
    const configResp = await fetch(`${baseUrl}/api/extension/config`, {
      headers: getAletheiaRequestHeaders(),
    });
    if (configResp.ok) {
      const config = await configResp.json();
      supabaseUrl = config.supabase_url;
      supabaseAnonKey = config.supabase_anon_key;
    }
  } catch (e) {
    log.warn("auth.configuration.complete", {
      operationId,
      outcome: "failure",
      errorCode: getSafeErrorCode(e, "CONFIGURATION_UNAVAILABLE"),
    });
  }

  finish("success", { authSource: "cookie_fallback" });
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user
      ? {
          id: session.user.id,
          email: session.user.email,
          full_name:
            session.user.user_metadata?.full_name ||
            session.user.email?.split("@")[0],
        }
      : null,
    supabase_url: supabaseUrl,
    supabase_anon_key: supabaseAnonKey,
  };
}

// ─── Token refresh ───

// In-flight guard: Supabase rotates refresh tokens, so using the same refresh_token
// twice will fail. This ensures only one refresh runs at a time.
const refreshes = new Map();

async function refreshToken(expected, operationId) {
  const { auth, revision } = expected;
  const key = auth.refresh_token;
  const existing = refreshes.get(key);
  if (existing?.revision === revision) {
    log.info("auth.refresh.coalesced", { operationId });
    return existing.pending;
  }

  // Share the successful rotation. A rejection leaves cleanup to each caller.
  const pending = requestTokenRefresh({ ...auth }, operationId)
    .then(async (updatedAuth) => {
      if (updatedAuth.user?.id !== auth.user?.id) throw authAccountChanged();
      await storeAuth(updatedAuth, expected);
      return updatedAuth;
    })
    .finally(() => {
      if (refreshes.get(key)?.pending === pending) refreshes.delete(key);
    });
  refreshes.set(key, { revision, pending });
  return pending;
}

async function requestTokenRefresh(auth, operationId) {
  const complete = startExtensionTimedStage(log, "auth.token_refresh", {
    operationId,
  });

  if (
    !auth ||
    !auth.refresh_token ||
    !auth.supabase_url ||
    !auth.supabase_anon_key
  ) {
    // Try to fetch config if missing
    if (
      auth &&
      auth.refresh_token &&
      (!auth.supabase_url || !auth.supabase_anon_key)
    ) {
      try {
        const { apiBaseUrl } = await chrome.storage.sync.get("apiBaseUrl");
        const { apiUrl } = await chrome.storage.local.get("apiUrl");
        const url = normalizeApiUrl(
          apiBaseUrl || apiUrl || "https://www.aletheia.live",
        );
        const configResp = await fetch(`${url}/api/extension/config`, {
          headers: getAletheiaRequestHeaders(),
        });
        if (configResp.ok) {
          const config = await configResp.json();
          auth.supabase_url = config.supabase_url;
          auth.supabase_anon_key = config.supabase_anon_key;
        }
      } catch (error) {
        log.info("auth.configuration.complete", {
          operationId,
          outcome: "failure",
          errorCode: getSafeErrorCode(error, "CONFIGURATION_UNAVAILABLE"),
        });
      }
    }

    if (
      !auth?.refresh_token ||
      !auth?.supabase_url ||
      !auth?.supabase_anon_key
    ) {
      complete("failure", {
        errorCode: "REFRESH_CREDENTIALS_UNAVAILABLE",
      });
      throw new Error("Missing refresh credentials");
    }
  }

  const response = await fetch(
    `${auth.supabase_url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: auth.supabase_anon_key,
      },
      body: JSON.stringify({ refresh_token: auth.refresh_token }),
    },
  );

  if (!response.ok) {
    await response.text().catch(() => "");
    const error = createAuthFailure("Token refresh failed", {
      code: "TOKEN_REFRESH_FAILED",
      status: response.status,
    });
    complete("failure", { errorCode: error.code, status: response.status });
    throw error;
  }

  const data = await response.json();

  const updatedAuth = {
    ...auth,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user: data.user
      ? {
          id: data.user.id,
          email: data.user.email,
          full_name:
            data.user.user_metadata?.full_name ||
            data.user.email?.split("@")[0],
        }
      : auth.user,
  };

  complete("success");
  return updatedAuth;
}

const webSessionWrites = new WeakMap();

export async function recoverWebSession(
  apiUrl,
  operationId,
  expected,
  { ownerId = expected.auth?.user?.id, requireValid = false } = {},
) {
  const session = await fetchSessionFromWebApp(
    apiUrl,
    operationId,
    expected.revision,
  );
  if (ownerId && session.user?.id !== ownerId) throw authAccountChanged();
  if (requireValid && !isTokenValid(session)) {
    throw createAuthFailure("No active web session found.", {
      code: "SESSION_UNAVAILABLE",
    });
  }
  let write = webSessionWrites.get(session);
  if (!write) {
    write = storeAuth(session, expected);
    webSessionWrites.set(session, write);
  }
  await write;
  return session;
}

// ─── Main entry point ───

export async function getValidAccessToken(
  apiUrl,
  { allowSessionFetch = true, operationId, expected, webOwnerId } = {},
) {
  apiUrl = normalizeApiUrl(apiUrl);
  const complete = startExtensionTimedStage(log, "auth.access_token", {
    operationId,
  });
  expected ??= await getAuthSnapshot();
  const { auth } = expected;

  // If we have a valid, non-expiring-soon token, return it
  if (auth && isTokenValid(auth) && !needsRefresh(auth)) {
    complete("success", { authSource: "stored_token" });
    return auth.access_token;
  }

  // Try to refresh if we have a refresh token
  if (auth && auth.refresh_token) {
    try {
      const refreshed = await refreshToken(expected, operationId);
      complete("success", { authSource: "refreshed_token" });
      return refreshed.access_token;
    } catch (refreshError) {
      if (refreshError.code === "AUTH_ACCOUNT_CHANGED") throw refreshError;
      log.info("auth.refresh.complete", {
        operationId,
        outcome: "fallback",
        errorCode: getSafeErrorCode(refreshError, "TOKEN_REFRESH_FAILED"),
      });
    }
  }

  if (!allowSessionFetch) {
    complete("failure", { errorCode: "STORED_AUTH_UNAVAILABLE" });
    throw createAuthFailure(
      "Not authenticated. Please reconnect the extension.",
      { cause: "STORED_AUTH_UNAVAILABLE" },
    );
  }

  // Fall back to fetching a new session from the web app
  try {
    const sessionData = await recoverWebSession(apiUrl, operationId, expected, {
      ownerId: webOwnerId,
    });
    complete("success", { authSource: "web_session" });
    return sessionData.access_token;
  } catch (fetchError) {
    if (fetchError.code === "AUTH_ACCOUNT_CHANGED") throw fetchError;
    await clearAuth(expected);
    complete("failure", {
      errorCode: getSafeErrorCode(fetchError, "AUTH_REQUIRED"),
      status: typeof fetchError.status === "number" ? fetchError.status : 401,
    });
    throw createAuthFailure(
      'Not authenticated. Please log in to the Aletheia web app and click "Connect" in the extension.',
      {
        code: fetchError.code || "AUTH_REQUIRED",
        status: fetchError.status || 401,
        cause: fetchError.authCause || fetchError.code,
      },
    );
  }
}

// ─── Auth status helper ───

export async function getAuthStatus() {
  const { auth } = await getAuthSnapshot();
  if (!auth || !auth.access_token) {
    log.info("auth.status.complete", { authenticated: false });
    return { authenticated: false };
  }
  const valid = isTokenValid(auth);
  log.info("auth.status.complete", { authenticated: valid });
  return {
    authenticated: valid,
    user: auth.user || null,
    expires_at: auth.expires_at,
    needs_refresh: needsRefresh(auth),
  };
}

// ─── Wait for login (used by handleAuthenticate) ───
// Keep-alive: MV3 service workers can be terminated. Use alarms to keep alive.
// Recovery from restarts is handled in service-worker.js.

const LOGIN_KEEPALIVE_ALARM = "aletheia-login-keepalive";

// Pending login resolve/reject — allows authBridgeSession messages to settle the promise
let _loginResolve = null;
let _loginReject = null;

export async function waitForLogin(apiUrl, operationId, ownerId) {
  apiUrl = normalizeApiUrl(apiUrl);
  const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const complete = startExtensionTimedStage(log, "auth.login_wait", {
    operationId,
  });

  const expected = await getAuthSnapshot();
  ownerId ??= expected.auth?.user?.id;

  // Tab deduplication
  const loginUrl = `${apiUrl}/auth/login?source=extension`;
  const existingTabs = await chrome.tabs.query({
    url: `${apiUrl}/auth/login*`,
  });
  let tab;
  if (existingTabs.length > 0) {
    tab = existingTabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    log.info("auth.login_tab.ready", { operationId, reused: true });
  } else {
    tab = await chrome.tabs.create({ url: loginUrl });
    log.info("auth.login_tab.ready", { operationId, reused: false });
  }

  // Persist login state (survives service worker restart)
  return queueAuthOperation(async () => {
    await assertAuthSnapshot(expected);
    const timeoutAt = Date.now() + LOGIN_TIMEOUT_MS;
    await chrome.storage.local.set({
      _loginPending: {
        apiUrl,
        tabId: tab.id,
        startedAt: Date.now(),
        timeoutAt,
        ownerId,
        initialOwnerId: expected.auth?.user?.id,
        initialStoredAt: expected.auth?.stored_at,
      },
    });
    chrome.alarms.create(LOGIN_KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
    // Start the poll before releasing the queue so logout can always cancel it.
    return {
      login: pollUntilSession(
        apiUrl,
        tab.id,
        timeoutAt,
        operationId,
        complete,
        expected,
        ownerId,
      ),
    };
  }).then(({ login }) => login);
}

// Inject auth-bridge content script into the login tab
async function injectAuthBridge(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/auth-bridge.js"],
    });
    log.info("auth.bridge.inject.complete", { outcome: "success" });
  } catch (error) {
    log.warn("auth.bridge.inject.complete", {
      outcome: "failure",
      errorCode: getSafeErrorCode(error, "AUTH_BRIDGE_INJECTION_FAILED"),
    });
  }
}

// Handle session data sent from auth-bridge content script
export function matchesPendingLogin(pending, expected) {
  return (
    (pending.initialOwnerId ?? null) === (expected.auth?.user?.id ?? null) &&
    (pending.initialStoredAt ?? null) === (expected.auth?.stored_at ?? null)
  );
}

export function handleAuthBridgeSession(sessionData, operationId, tabId) {
  if (!sessionData || !sessionData.access_token) return;
  log.info("auth.bridge.session_received", { operationId });

  // Fetch Supabase config and store
  getAuthSnapshot()
    .then(async (expected) => {
      const [{ apiBaseUrl }, { apiUrl, _loginPending }] = await Promise.all([
        chrome.storage.sync.get("apiBaseUrl"),
        chrome.storage.local.get(["apiUrl", "_loginPending"]),
      ]);
      if (
        tabId === undefined ||
        _loginPending?.tabId !== tabId ||
        _loginPending.timeoutAt <= Date.now() ||
        !matchesPendingLogin(_loginPending, expected) ||
        isTokenValid(expected.auth)
      )
        return;
      const url = normalizeApiUrl(
        apiBaseUrl || apiUrl || "https://www.aletheia.live",
      );
      let supabaseUrl, supabaseAnonKey;
      try {
        const configResp = await fetch(`${url}/api/extension/config`, {
          headers: getAletheiaRequestHeaders(),
        });
        if (configResp.ok) {
          const config = await configResp.json();
          supabaseUrl = config.supabase_url;
          supabaseAnonKey = config.supabase_anon_key;
        }
      } catch (e) {
        log.info("auth.configuration.complete", {
          operationId,
          outcome: "failure",
          errorCode: "CONFIGURATION_UNAVAILABLE",
        });
      }

      const authData = {
        ...sessionData,
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseAnonKey,
      };

      if (
        _loginPending.ownerId &&
        authData.user?.id !== _loginPending.ownerId
      ) {
        throw authAccountChanged();
      }
      await storeAuth(authData, expected);

      // Resolve the pending login promise
      if (_loginResolve) {
        _loginResolve(authData);
        _loginResolve = null;
        _loginReject = null;
      }
    })
    .catch((error) => {
      log.info("auth.bridge.complete", {
        outcome: "failure",
        errorCode: getSafeErrorCode(error, "AUTHENTICATION_FAILED"),
      });
    });
}

// Uses setTimeout loop + content script bridge + cookie/tab listeners
const POLL_INTERVALS = [3000, 5000, 8000, 13000, 15000];

function pollUntilSession(
  apiUrl,
  tabId,
  timeoutAt,
  operationId,
  complete,
  expected,
  ownerId,
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer = null;
    let cookieDebounceTimer = null;
    let timeoutTimer = null;
    let bridgeInjected = false;
    let pollStep = 0;
    let fetchInFlight = false;

    // Store resolve/reject so authBridgeSession messages can settle this promise
    _loginResolve = (data) => {
      complete("success", { authSource: "auth_bridge" });
      settle(() => resolve(data), true);
    };
    _loginReject = (err) => settle(() => reject(err), false);

    function cleanup(shouldCloseTab) {
      chrome.cookies.onChanged.removeListener(cookieListener);
      chrome.tabs.onUpdated.removeListener(tabListener);
      chrome.alarms.clear(LOGIN_KEEPALIVE_ALARM);
      chrome.storage.local.remove("_loginPending");
      clearTimeout(pollTimer);
      clearTimeout(cookieDebounceTimer);
      clearTimeout(timeoutTimer);
      _loginResolve = null;
      _loginReject = null;
      // Only close the login tab on successful login
      if (shouldCloseTab) {
        try {
          chrome.tabs.remove(tabId);
        } catch (e) {
          /* already closed */
        }
      }
    }

    function settle(fn, shouldCloseTab = false) {
      if (settled) return;
      settled = true;
      cleanup(shouldCloseTab);
      fn();
    }

    function resetPollStep() {
      pollStep = 0;
    }

    async function tryFetchSession() {
      if (settled || fetchInFlight) return;
      fetchInFlight = true;
      try {
        const sessionData = await recoverWebSession(
          apiUrl,
          operationId,
          expected,
          { ownerId },
        );
        complete("success");
        settle(() => resolve(sessionData), true);
      } catch (e) {
        if (e.code === "AUTH_ACCOUNT_CHANGED") {
          settle(() => reject(e), false);
        } else if (e.status === 401) {
          log.info("auth.login_poll.complete", {
            operationId,
            outcome: "pending",
            status: 401,
          });
        } else {
          log.info("auth.login_poll.complete", {
            operationId,
            outcome: "pending",
            errorCode: getSafeErrorCode(e, "SESSION_UNAVAILABLE"),
          });
        }
      } finally {
        fetchInFlight = false;
      }
    }

    // Cookie change listener (debounced for chunked cookies)
    function cookieListener(changeInfo) {
      if (changeInfo.removed) return;
      const { cookie } = changeInfo;
      if (
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("-auth-token")
      ) {
        log.info("auth.cookie_change.detected", { operationId });
        resetPollStep();
        clearTimeout(cookieDebounceTimer);
        cookieDebounceTimer = setTimeout(() => {
          if (!settled) tryFetchSession();
        }, 500);
      }
    }
    chrome.cookies.onChanged.addListener(cookieListener);

    // Tab load listener — inject auth-bridge when login tab loads
    function tabListener(tid, changeInfo) {
      if (tid === tabId && changeInfo.status === "complete") {
        resetPollStep();
        if (!bridgeInjected) {
          bridgeInjected = true;
          injectAuthBridge(tabId);
        } else {
          // Tab reloaded (e.g., after form submit) — re-inject
          injectAuthBridge(tabId);
        }
        // Also try server endpoint as fallback
        setTimeout(() => {
          if (!settled) tryFetchSession();
        }, 1000);
      }
    }
    chrome.tabs.onUpdated.addListener(tabListener);

    // setTimeout-based polling with stepped backoff
    function schedulePoll() {
      const interval =
        POLL_INTERVALS[Math.min(pollStep, POLL_INTERVALS.length - 1)];
      pollTimer = setTimeout(async () => {
        if (settled) return;
        await tryFetchSession();
        pollStep++;
        if (!settled) schedulePoll();
      }, interval);
    }
    schedulePoll();

    // Timeout
    const remaining = timeoutAt - Date.now();
    timeoutTimer = setTimeout(
      () => {
        complete("failure", { errorCode: "LOGIN_TIMEOUT" });
        settle(
          () => reject(new Error("Login timed out. Please try again.")),
          false,
        );
      },
      Math.max(remaining, 0),
    );
  });
}

// ─── Recover the session for a generation ───

export async function recoverGenerationSession(
  apiUrl,
  operationId,
  expected,
  ownerId,
) {
  expected ??= await getAuthSnapshot();
  try {
    return await recoverWebSession(apiUrl, operationId, expected, { ownerId });
  } catch (error) {
    if (error.code !== "AUTH_ACCOUNT_CHANGED") await clearAuth(expected);
    throw error;
  }
}

// ─── Proactive refresh (called by alarm) ───

export async function proactiveRefresh(apiUrl, operationId) {
  const expected = await getAuthSnapshot();
  const { auth } = expected;
  if (!needsRefresh(auth) || !auth?.refresh_token) return;

  try {
    await refreshToken(expected, operationId);
    log.info("auth.proactive_refresh.complete", {
      operationId,
      outcome: "success",
      authSource: "refresh_token",
    });
  } catch (error) {
    if (error.code === "AUTH_ACCOUNT_CHANGED") return;
    try {
      await recoverWebSession(apiUrl, operationId, expected);
      log.info("auth.proactive_refresh.complete", {
        operationId,
        outcome: "success",
        authSource: "web_session",
      });
    } catch (fetchError) {
      if (fetchError.code === "AUTH_ACCOUNT_CHANGED") return;
      if (
        [400, 401].includes(error.status) ||
        ["SESSION_REFRESH_REJECTED", "refresh_token_already_used"].includes(
          fetchError.code,
        )
      ) {
        await clearAuth(expected).catch((clearError) => {
          if (clearError.code !== "AUTH_ACCOUNT_CHANGED") throw clearError;
        });
      }
      log.warn("auth.proactive_refresh.complete", {
        operationId,
        outcome: "failure",
        errorCode: getSafeErrorCode(fetchError, "SESSION_UNAVAILABLE"),
      });
    }
  }
}

export async function restorePopupSession(apiUrl, operationId, expected) {
  const { auth } = expected;
  if (isTokenValid(auth)) return;
  if (auth?.refresh_token) {
    try {
      await refreshToken(expected, operationId);
      return;
    } catch (error) {
      if (error.code === "AUTH_ACCOUNT_CHANGED") return;
    }
  }
  await recoverWebSession(apiUrl, operationId, expected, {
    requireValid: true,
  });
}
