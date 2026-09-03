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

export async function storeAuth(authData) {
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
}

export async function clearAuth() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
  log.info("auth.storage.cleared", { outcome: "success" });
}

// ─── Token validation ───

function isTokenValid(auth) {
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

let _fetchSessionPromise = null;

export async function fetchSessionFromWebApp(apiUrl, operationId) {
  if (_fetchSessionPromise) {
    log.info("auth.session.coalesced", { operationId });
    return _fetchSessionPromise;
  }
  _fetchSessionPromise = _doFetchSessionFromWebApp(apiUrl, operationId).finally(
    () => {
      _fetchSessionPromise = null;
    },
  );
  return _fetchSessionPromise;
}

async function _doFetchSessionFromWebApp(apiUrl, operationId) {
  const baseUrl = normalizeApiUrl(apiUrl);
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
      if (
        errorBody.code === "SESSION_REFRESH_REJECTED" ||
        errorBody.code === "refresh_token_already_used"
      ) {
        log.info("auth.storage.clear_requested", {
          operationId,
          reason: "stale_session",
        });
        await clearAuth();
      }
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
let _refreshPromise = null;

async function refreshToken(auth, operationId) {
  // If a refresh is already in flight, reuse its result
  if (_refreshPromise) {
    log.info("auth.refresh.coalesced", { operationId });
    return _refreshPromise;
  }

  _refreshPromise = _doRefreshToken(auth, operationId).finally(() => {
    _refreshPromise = null;
  });

  return _refreshPromise;
}

async function _doRefreshToken(auth, operationId) {
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
    // If refresh token is consumed/expired, clear auth so user gets prompted to re-login
    if (response.status === 400 || response.status === 401) {
      await clearAuth();
    }
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

  await storeAuth(updatedAuth);
  complete("success");
  return updatedAuth;
}

// ─── Main entry point ───

export async function getValidAccessToken(
  apiUrl,
  { allowSessionFetch = true, operationId } = {},
) {
  apiUrl = normalizeApiUrl(apiUrl);
  const complete = startExtensionTimedStage(log, "auth.access_token", {
    operationId,
  });
  let auth = await getStoredAuth();

  // If we have a valid, non-expiring-soon token, return it
  if (auth && isTokenValid(auth) && !needsRefresh(auth)) {
    complete("success", { authSource: "stored_token" });
    return auth.access_token;
  }

  // Try to refresh if we have a refresh token
  if (auth && auth.refresh_token) {
    try {
      auth = await refreshToken(auth, operationId);
      complete("success", { authSource: "refreshed_token" });
      return auth.access_token;
    } catch (refreshError) {
      log.info("auth.refresh.complete", {
        operationId,
        outcome: "fallback",
        errorCode: getSafeErrorCode(refreshError, "TOKEN_REFRESH_FAILED"),
      });
    }
  }

  if (!allowSessionFetch) {
    await clearAuth();
    complete("failure", { errorCode: "STORED_AUTH_UNAVAILABLE" });
    throw createAuthFailure(
      "Not authenticated. Please reconnect the extension.",
      { cause: "STORED_AUTH_UNAVAILABLE" },
    );
  }

  // Fall back to fetching a new session from the web app
  try {
    const sessionData = await fetchSessionFromWebApp(apiUrl, operationId);
    await storeAuth(sessionData);
    complete("success", { authSource: "web_session" });
    return sessionData.access_token;
  } catch (fetchError) {
    // Clear stale auth
    await clearAuth();
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
  const auth = await getStoredAuth();
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

export async function waitForLogin(apiUrl, operationId) {
  apiUrl = normalizeApiUrl(apiUrl);
  const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const complete = startExtensionTimedStage(log, "auth.login_wait", {
    operationId,
  });

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
  await chrome.storage.local.set({
    _loginPending: {
      apiUrl,
      tabId: tab.id,
      startedAt: Date.now(),
      timeoutAt: Date.now() + LOGIN_TIMEOUT_MS,
    },
  });

  // Set keepalive alarm to prevent service worker termination during login
  chrome.alarms.create(LOGIN_KEEPALIVE_ALARM, { periodInMinutes: 0.5 }); // 30s — Chrome minimum

  // Start polling for session
  return pollUntilSession(
    apiUrl,
    tab.id,
    Date.now() + LOGIN_TIMEOUT_MS,
    operationId,
    complete,
  );
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
export function handleAuthBridgeSession(sessionData, operationId) {
  if (!sessionData || !sessionData.access_token) return;
  log.info("auth.bridge.session_received", { operationId });

  // Fetch Supabase config and store
  Promise.all([
    chrome.storage.sync.get("apiBaseUrl"),
    chrome.storage.local.get("apiUrl"),
  ]).then(async ([{ apiBaseUrl }, { apiUrl }]) => {
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

    await storeAuth(authData);

    // Resolve the pending login promise
    if (_loginResolve) {
      _loginResolve(authData);
      _loginResolve = null;
      _loginReject = null;
    }
  });
}

// Uses setTimeout loop + content script bridge + cookie/tab listeners
const POLL_INTERVALS = [3000, 5000, 8000, 13000, 15000];

function pollUntilSession(apiUrl, tabId, timeoutAt, operationId, complete) {
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
      if (fetchInFlight) return;
      fetchInFlight = true;
      try {
        const sessionData = await fetchSessionFromWebApp(apiUrl, operationId);
        await storeAuth(sessionData);
        complete("success");
        settle(() => resolve(sessionData), true);
      } catch (e) {
        if (e.status === 401) {
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

// ─── Clear auth and fetch fresh session ───

export async function clearAuthAndFetchFresh(apiUrl, operationId) {
  apiUrl = normalizeApiUrl(apiUrl);
  const complete = startExtensionTimedStage(log, "auth.session_recovery", {
    operationId,
  });
  await clearAuth();
  try {
    const sessionData = await fetchSessionFromWebApp(apiUrl, operationId);
    await storeAuth(sessionData);
    complete("success");
    return sessionData;
  } catch (error) {
    complete("failure", {
      errorCode: getSafeErrorCode(error, "SESSION_RECOVERY_FAILED"),
    });
    throw error;
  }
}

// ─── Proactive refresh (called by alarm) ───

export async function proactiveRefresh(apiUrl, operationId) {
  apiUrl = normalizeApiUrl(apiUrl);
  const auth = await getStoredAuth();
  if (!auth) return;

  if (needsRefresh(auth) && auth.refresh_token) {
    try {
      await refreshToken(auth, operationId);
      log.info("auth.proactive_refresh.complete", {
        operationId,
        outcome: "success",
        authSource: "refresh_token",
      });
    } catch (error) {
      log.info("auth.proactive_refresh.complete", {
        operationId,
        outcome: "fallback",
        errorCode: getSafeErrorCode(error, "TOKEN_REFRESH_FAILED"),
      });
      // Try fetching from web app as fallback
      try {
        const sessionData = await fetchSessionFromWebApp(apiUrl, operationId);
        await storeAuth(sessionData);
        log.info("auth.proactive_refresh.complete", {
          operationId,
          outcome: "success",
          authSource: "web_session",
        });
      } catch (fetchError) {
        log.warn("auth.proactive_refresh.complete", {
          operationId,
          outcome: "failure",
          errorCode: getSafeErrorCode(fetchError, "SESSION_UNAVAILABLE"),
        });
      }
    }
  }
}
