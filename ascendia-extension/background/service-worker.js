import { isValidOperationId } from "../lib/logger-core.js";
// Aletheia Extension Background Service Worker
// Handles API communication with the Aletheia backend

import {
  clearAuth,
  clearAuthAndFetchFresh,
  fetchSessionFromWebApp,
  getAletheiaRequestHeaders,
  getAuthStatus,
  getValidAccessToken,
  handleAuthBridgeSession,
  proactiveRefresh,
  storeAuth,
  waitForLogin,
} from "./auth.js";
import {
  buildGenerationRequestData,
  serializeGenerationError,
} from "./generation-core.js";
import { generateWithAuthRecovery } from "./generate-auth-recovery.js";
import {
  createExtensionLogger,
  createOperationId,
  startExtensionTimedStage,
} from "../lib/logger.js";

const log = createExtensionLogger("service-worker");
const CONTENT_DIAGNOSTIC_EVENTS = new Set([
  "profile_reader.initialized",
  "profile_reader.consent_pending",
  "profile_reader.extraction_complete",
  "profile_reader.extraction_failed",
  "profile_reader.message_failed",
  "profile_reader.cleanup",
  "auto_filler.initialized",
  "auto_filler.complete",
]);

function getSafeErrorCode(error, fallback) {
  return typeof error?.code === "string" && /^[A-Z0-9_]{3,80}$/.test(error.code)
    ? error.code
    : fallback;
}

// In-flight guard: prevents duplicate authenticate calls from opening multiple tabs
let authenticatePromise = null;

// Recover from service worker restart during login
(async function recoverPendingLogin() {
  const { _loginPending } = await chrome.storage.local.get("_loginPending");
  if (!_loginPending) return;

  const { apiUrl, tabId, timeoutAt } = _loginPending;
  if (Date.now() > timeoutAt) {
    log.info("auth.recovery.complete", {
      outcome: "expired",
      stage: "auth.recovery",
    });
    await chrome.storage.local.remove("_loginPending");
    return;
  }

  const completeRecovery = startExtensionTimedStage(log, "auth.recovery");
  // Try to fetch the session immediately (user may have already logged in)
  try {
    const sessionData = await fetchSessionFromWebApp(apiUrl);
    await storeAuth(sessionData);
    await chrome.storage.local.remove("_loginPending");
    try {
      chrome.tabs.remove(tabId);
    } catch (e) {}
    chrome.alarms.clear("aletheia-login-keepalive");
    completeRecovery("success");
  } catch (e) {
    completeRecovery("failure", {
      errorCode: getSafeErrorCode(e, "SESSION_UNAVAILABLE"),
    });
    // Keep the keepalive alarm running; next alarm cycle will retry
    chrome.alarms.create("aletheia-login-keepalive", {
      periodInMinutes: 25 / 60,
    });
  }
})();

// Cold-start alarm guard: re-create token refresh alarm if service worker
// wakes on a non-startup/non-install event and the alarm is missing.
chrome.alarms.get("aletheia-token-refresh", (alarm) => {
  if (!alarm) {
    log.info("runtime.alarm.created", { alarm: "token_refresh" });
    chrome.alarms.create("aletheia-token-refresh", { periodInMinutes: 20 });
  }
});

// Extension configuration
const CONFIG = {
  DEFAULT_API_URL: "https://www.aletheia.live", // Production default
  API_ENDPOINTS: {
    generate: "/api/extension/generate",
    health: "/api/extension/generate",
  },
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  TOKEN_REFRESH_ALARM: "aletheia-token-refresh",
  TOKEN_REFRESH_INTERVAL_MIN: 20, // Refresh every 20 minutes (well before 1hr JWT expiry)
};

// Installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  log.info("runtime.installed", { reason: details.reason });

  if (details.reason === "install") {
    await initializeDefaultSettings();
  }

  // Inject content scripts into already-open LinkedIn tabs
  // (Chrome does NOT auto-inject on install/update)
  try {
    const tabs = await chrome.tabs.query({
      url: "https://www.linkedin.com/in/*",
    });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: ["content/linkedin-reader.js"],
          })
          .catch(() =>
            log.warn("content.inject.complete", {
              outcome: "failure",
              errorCode: "CONTENT_SCRIPT_INJECTION_FAILED",
            }),
          );
      }
    }
  } catch {
    log.warn("content.inject.complete", {
      outcome: "failure",
      errorCode: "CONTENT_SCRIPT_INJECTION_FAILED",
    });
  }

  // Set up proactive token refresh alarm
  chrome.alarms.create(CONFIG.TOKEN_REFRESH_ALARM, {
    periodInMinutes: CONFIG.TOKEN_REFRESH_INTERVAL_MIN,
  });
});

chrome.runtime.onStartup.addListener(() => {
  log.info("runtime.startup", { outcome: "success" });

  // Ensure token refresh alarm exists
  chrome.alarms.create(CONFIG.TOKEN_REFRESH_ALARM, {
    periodInMinutes: CONFIG.TOKEN_REFRESH_INTERVAL_MIN,
  });
});

// Alarm handler for proactive token refresh + login recovery
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CONFIG.TOKEN_REFRESH_ALARM) {
    const url = await getEffectiveApiUrl();
    const complete = startExtensionTimedStage(log, "auth.proactive_refresh");
    try {
      await proactiveRefresh(url);
      complete("success");
    } catch (error) {
      complete("failure", {
        errorCode: getSafeErrorCode(error, "TOKEN_REFRESH_FAILED"),
      });
    }
  }

  if (alarm.name === "aletheia-login-keepalive") {
    const { _loginPending } = await chrome.storage.local.get("_loginPending");
    if (!_loginPending) return;

    if (Date.now() > _loginPending.timeoutAt) {
      log.info("auth.keepalive.complete", {
        stage: "auth.keepalive",
        outcome: "expired",
      });
      await chrome.storage.local.remove("_loginPending");
      chrome.alarms.clear("aletheia-login-keepalive");
      return;
    }

    try {
      const sessionData = await fetchSessionFromWebApp(_loginPending.apiUrl);
      await storeAuth(sessionData);
      await chrome.storage.local.remove("_loginPending");
      try {
        chrome.tabs.remove(_loginPending.tabId);
      } catch (e) {}
      chrome.alarms.clear("aletheia-login-keepalive");
      log.info("auth.keepalive.complete", {
        stage: "auth.keepalive",
        outcome: "success",
      });
    } catch (error) {
      log.info("auth.keepalive.complete", {
        stage: "auth.keepalive",
        outcome: "pending",
        errorCode: getSafeErrorCode(error, "SESSION_UNAVAILABLE"),
      });
    }
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const operationId = createOperationId(message.operationId);
  const messageStartedAt = Date.now();
  log.info("runtime.message.start", { operationId, action: message.action });

  if (message.action === "diagnostic") {
    if (CONTENT_DIAGNOSTIC_EVENTS.has(message.event)) {
      const fields = message.fields ?? {};
      log.info(`content.${message.event}`, {
        operationId,
        outcome:
          fields.outcome === "failure" || fields.outcome === "success"
            ? fields.outcome
            : undefined,
        errorCode:
          typeof fields.errorCode === "string" &&
          /^[A-Z0-9_]{3,80}$/.test(fields.errorCode)
            ? fields.errorCode
            : undefined,
        contentLength:
          Number.isSafeInteger(fields.contentLength) &&
          fields.contentLength >= 0
            ? fields.contentLength
            : undefined,
        changed:
          typeof fields.changed === "boolean" ? fields.changed : undefined,
        platform:
          fields.platform === "linkedin" || fields.platform === "apollo"
            ? fields.platform
            : undefined,
      });
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "generate") {
    handleGenerateRequest(message.payload, operationId)
      .then((result) => {
        log.info("runtime.message.complete", {
          operationId,
          action: message.action,
          outcome: "success",
          durationMs: Date.now() - messageStartedAt,
        });
        sendResponse({ ...result, operationId });
      })
      .catch((error) => {
        const result = serializeGenerationError(error);
        log.warn("runtime.message.complete", {
          operationId,
          action: message.action,
          outcome: "failure",
          durationMs: Date.now() - messageStartedAt,
          errorCode: result.code,
          status: result.status,
        });
        sendResponse({ ...result, operationId });
      });
    return true;
  }

  if (message.action === "healthCheck") {
    handleHealthCheck()
      .then((result) => {
        log.info("runtime.message.complete", {
          operationId,
          action: message.action,
          outcome: result.success ? "success" : "failure",
          durationMs: Date.now() - messageStartedAt,
        });
        sendResponse(result);
      })
      .catch(() =>
        sendResponse({
          success: false,
          error: "Health check failed",
        }),
      );
    return true;
  }

  if (message.action === "authenticate") {
    log.info("auth.interactive.start", {
      operationId,
      coalesced: Boolean(authenticatePromise),
    });
    if (!authenticatePromise) {
      authenticatePromise = handleAuthenticate(operationId)
        .then((result) => {
          log.info("auth.interactive.complete", {
            operationId,
            outcome: "success",
          });
          authenticatePromise = null;
          return result;
        })
        .catch((error) => {
          log.warn("auth.interactive.complete", {
            operationId,
            outcome: "failure",
            errorCode: getSafeErrorCode(error, "AUTHENTICATION_FAILED"),
          });
          authenticatePromise = null;
          throw error;
        });
    }
    authenticatePromise
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message || "Authentication failed",
        }),
      );
    return true;
  }

  if (message.action === "logout") {
    handleLogout(operationId)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message || "Logout failed",
        }),
      );
    return true;
  }

  if (message.action === "getAuthStatus") {
    getAuthStatus()
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          authenticated: false,
          error: error.message,
        }),
      );
    return true;
  }

  // Silent auth check: try to detect an existing web session without opening any tabs.
  // Used by popup on initialization to auto-detect if user is already logged in.
  if (message.action === "silentAuthCheck") {
    (async () => {
      try {
        const url = await getEffectiveApiUrl();
        await getValidAccessToken(url, { operationId });
        const status = await getAuthStatus();
        log.info("auth.silent_check.complete", {
          operationId,
          outcome: "success",
        });
        sendResponse(status);
      } catch (error) {
        log.info("auth.silent_check.complete", {
          operationId,
          outcome: "failure",
          errorCode: getSafeErrorCode(error, "AUTH_REQUIRED"),
        });
        sendResponse({ authenticated: false });
      }
    })();
    return true;
  }

  // Auth bridge: content script on login page found the Supabase session
  if (message.action === "authBridgeSession") {
    log.info("auth.bridge.received", { operationId });
    handleAuthBridgeSession(message.session, operationId);
    sendResponse({ success: true });
    return true;
  }

  // Send feedback to backend (fire-and-forget)
  if (message.action === "sendFeedback") {
    sendResponse({ success: true }); // Respond immediately, don't block UI
    (async () => {
      try {
        const url = await getEffectiveApiUrl();
        const accessToken = await getValidAccessToken(url, { operationId });
        await fetch(`${url}/api/extension/feedback`, {
          method: "POST",
          headers: getAletheiaRequestHeaders({
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          }),
          body: JSON.stringify(message.payload),
        });
        log.info("feedback.dispatch.complete", {
          operationId,
          outcome: "success",
        });
      } catch (error) {
        log.warn("feedback.dispatch.complete", {
          operationId,
          outcome: "failure",
          errorCode: getSafeErrorCode(error, "FEEDBACK_DISPATCH_FAILED"),
        });
      }
    })();
    return true;
  }

  return false;
});

// Helper: resolve the effective API URL from sync > local > default.
// Only allow hosts present in manifest host_permissions to prevent
// stale storage values (e.g. localhost from dev installs, *.vercel.app
// from earlier prod fallback) from routing requests to disallowed
// origins after manifest narrowing.
const ALLOWED_API_HOSTS = ["aletheia.live", "www.aletheia.live"];
function normalizeApiUrl(value) {
  let normalized = String(value || "").trim();
  while (normalized.endsWith("/") && !normalized.endsWith("://")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
function isAllowedApiUrl(value) {
  const normalized = normalizeApiUrl(value);
  if (!normalized) return false;
  try {
    return ALLOWED_API_HOSTS.includes(new URL(normalized).hostname);
  } catch {
    return false;
  }
}
async function getEffectiveApiUrl() {
  const { apiBaseUrl } = await chrome.storage.sync.get("apiBaseUrl");
  if (isAllowedApiUrl(apiBaseUrl)) return normalizeApiUrl(apiBaseUrl);
  if (apiBaseUrl) {
    await chrome.storage.sync.remove("apiBaseUrl");
    log.info("settings.api_origin.reset", { storageArea: "sync" });
  }
  const { apiUrl } = await chrome.storage.local.get("apiUrl");
  if (isAllowedApiUrl(apiUrl)) return normalizeApiUrl(apiUrl);
  if (apiUrl) {
    await chrome.storage.local.remove("apiUrl");
    log.info("settings.api_origin.reset", { storageArea: "local" });
  }
  return CONFIG.DEFAULT_API_URL;
}

async function initializeDefaultSettings() {
  // Check if user has a saved API URL in sync storage (shared across devices)
  const { apiBaseUrl } = await chrome.storage.sync.get("apiBaseUrl");
  const apiUrl = normalizeApiUrl(apiBaseUrl || CONFIG.DEFAULT_API_URL);

  const defaults = {
    apiUrl,
    accepted: [],
    dailyUsage: {},
    settings: {
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50,
    },
  };

  await chrome.storage.local.set(defaults);
  log.info("settings.initialized", { outcome: "success" });
}

async function handleAuthenticate(operationId) {
  const url = await getEffectiveApiUrl();
  const complete = startExtensionTimedStage(log, "auth.interactive", {
    operationId,
  });

  // First try: maybe the user is already logged in (cookies exist)
  try {
    await getValidAccessToken(url, { operationId });
    const status = await getAuthStatus();
    complete("success", { authSource: "stored_session" });
    return {
      success: true,
      user: status.user,
      message: "Connected to Aletheia",
    };
  } catch {
    // No existing session — open login tab and wait for cookies
  }

  // Second try: open login page and wait for the user to authenticate
  try {
    const sessionData = await waitForLogin(url, operationId);
    complete("success", { authSource: "interactive_login" });
    return {
      success: true,
      user: sessionData.user,
      message: "Connected to Aletheia",
    };
  } catch (waitError) {
    complete("failure", {
      errorCode: getSafeErrorCode(waitError, "AUTHENTICATION_FAILED"),
    });
    throw new Error(waitError.message || "Login failed. Please try again.");
  }
}

async function handleLogout(operationId) {
  const complete = startExtensionTimedStage(log, "auth.logout", {
    operationId,
  });
  try {
    await clearAuth();
    complete("success");
    return { success: true, message: "Disconnected from Aletheia" };
  } catch (error) {
    complete("failure", {
      errorCode: getSafeErrorCode(error, "LOGOUT_FAILED"),
    });
    throw error;
  }
}

async function handleGenerateRequest(payload, operationId) {
  const complete = startExtensionTimedStage(log, "generation.workflow", {
    operationId,
  });
  try {
    const url = await getEffectiveApiUrl();
    const { accepted = [] } = await chrome.storage.local.get("accepted");
    const relevantExamples = accepted
      .filter((item) => item.category === payload.category)
      .map((item) => item.body || item.message)
      .slice(-3);
    const requestData = buildGenerationRequestData(payload, relevantExamples);
    let usageChecked = false;

    const response = await generateWithAuthRecovery({
      // Keep session exchange in the recovery state machine: a generation has
      // one silent exchange, rather than an implicit fetch on every token read.
      getAccessToken: () =>
        getValidAccessToken(url, { allowSessionFetch: false, operationId }),
      recoverSilently: () => clearAuthAndFetchFresh(url, operationId),
      clearAuth,
      authenticateInteractively: () => handleAuthenticate(operationId),
      generate: async (accessToken) => {
        if (!usageChecked) {
          await checkUsageLimit();
          usageChecked = true;
        }
        const result = await makeAPIRequest(
          "/api/extension/generate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(requestData),
          },
          url,
          operationId,
        );

        if (!result.success) {
          const responseError = new Error(
            result.message || result.error || "API request failed",
          );
          responseError.status = result.status;
          responseError.code = result.code;
          responseError.authCause = result.cause;
          responseError.apiResponse = result;
          throw responseError;
        }

        return result;
      },
    });

    await logUsage(payload.category);
    complete("success", { category: payload.category });
    return response;
  } catch (error) {
    complete("failure", {
      category: payload?.category,
      errorCode: getSafeErrorCode(error, "GENERATION_FAILED"),
    });
    throw error;
  }
}

async function makeAPIRequest(
  endpoint,
  options = {},
  baseUrl = null,
  operationId,
) {
  const url = (baseUrl || CONFIG.DEFAULT_API_URL) + endpoint;
  let lastError;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    const attemptStartedAt = Date.now();
    let attemptRequestId;
    try {
      log.info("api.request.start", {
        operationId,
        attempt,
        maxAttempts: CONFIG.MAX_RETRIES,
        method: options.method || "GET",
        endpoint,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...options,
        headers: getAletheiaRequestHeaders({
          ...(options.headers || {}),
          ...(operationId ? { "X-Aletheia-Operation-Id": operationId } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const receivedId = response.headers.get("x-request-id");
      attemptRequestId = isValidOperationId(receivedId)
        ? receivedId.toLowerCase()
        : undefined;

      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch (_jsonError) {
          errorBody = null;
        }

        const apiMessage =
          errorBody?.message ||
          errorBody?.error ||
          response.statusText ||
          "API request failed";
        const updateHint =
          response.status === 426 && errorBody?.chromeWebStoreUrl
            ? ` Update from ${errorBody.chromeWebStoreUrl}`
            : "";
        const apiError = new Error(
          `HTTP ${response.status}: ${apiMessage}${updateHint}`,
        );
        apiError.status = response.status;
        apiError.code = errorBody?.code;
        apiError.requestId = response.headers.get("x-request-id") || undefined;
        apiError.authCause = errorBody?.cause;
        apiError.updateUrl = errorBody?.chromeWebStoreUrl;
        apiError.apiResponse = errorBody;
        throw apiError;
      }

      const data = await response.json();
      log.info("api.request.complete", {
        attempt,
        durationMs: Math.max(0, Date.now() - attemptStartedAt),
        requestId: attemptRequestId,
        method: options.method || "GET",
        operationId,
        endpoint,
        status: response.status,
        outcome: "success",
      });

      return {
        ...data,
        requestId: response.headers.get("x-request-id") || undefined,
      };
    } catch (error) {
      lastError = error;
      log.warn("api.request.complete", {
        durationMs: Math.max(0, Date.now() - attemptStartedAt),
        requestId: attemptRequestId,
        method: options.method || "GET",
        operationId,
        endpoint,
        attempt,
        outcome: "failure",
        errorCode: getSafeErrorCode(error, "API_REQUEST_FAILED"),
        status: typeof error.status === "number" ? error.status : undefined,
      });

      if (error.name === "AbortError") {
        throw new Error("Request timeout. Please try again.");
      }

      if (
        error.status === 402 ||
        error.code === "INSUFFICIENT_CREDITS" ||
        error.message.includes("402")
      ) {
        throw error;
      }

      if (
        error.status === 426 ||
        error.code === "EXTENSION_UPDATE_REQUIRED" ||
        error.code === "API_VERSION_UNSUPPORTED"
      ) {
        throw error;
      }

      // Validation, billing, readiness, and compatibility failures are
      // deterministic client responses. Retrying them adds latency and can
      // repeat server work without changing the outcome.
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (error.message.includes("401") || error.message.includes("403")) {
        throw error;
      }

      if (attempt < CONFIG.MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

async function handleHealthCheck() {
  try {
    const url = await getEffectiveApiUrl();

    // Check if we have valid auth
    const status = await getAuthStatus();
    if (!status.authenticated) {
      return {
        success: false,
        error:
          "Not connected. Please log in to the web app and connect the extension.",
      };
    }

    const accessToken = await getValidAccessToken(url);

    const response = await makeAPIRequest(
      "/api/extension/generate",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      url,
    );

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function checkUsageLimit() {
  const { dailyUsage = {}, settings = {} } = await chrome.storage.local.get([
    "dailyUsage",
    "settings",
  ]);

  const today = new Date().toISOString().split("T")[0];
  const todayUsage = dailyUsage[today] || 0;
  const maxDailyUsage = settings.maxDailyUsage || 50;

  if (todayUsage >= maxDailyUsage) {
    throw new Error(
      `Daily usage limit (${maxDailyUsage}) exceeded. Try again tomorrow.`,
    );
  }
}

async function logUsage(category) {
  try {
    const { dailyUsage = {}, categoryUsage = {} } =
      await chrome.storage.local.get(["dailyUsage", "categoryUsage"]);

    const today = new Date().toISOString().split("T")[0];

    dailyUsage[today] = (dailyUsage[today] || 0) + 1;

    if (!categoryUsage[today]) {
      categoryUsage[today] = {};
    }
    categoryUsage[today][category] = (categoryUsage[today][category] || 0) + 1;

    // Clean up old usage data (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    Object.keys(dailyUsage).forEach((date) => {
      if (date < cutoffDate) delete dailyUsage[date];
    });

    Object.keys(categoryUsage).forEach((date) => {
      if (date < cutoffDate) delete categoryUsage[date];
    });

    await chrome.storage.local.set({ dailyUsage, categoryUsage });
  } catch (error) {
    log.warn("usage.record.complete", {
      outcome: "failure",
      errorCode: getSafeErrorCode(error, "USAGE_RECORD_FAILED"),
    });
  }
}

// Error handling for unhandled promise rejections
self.addEventListener("unhandledrejection", (event) => {
  log.error("runtime.unhandled_rejection", {
    outcome: "failure",
    errorCode: getSafeErrorCode(event.reason, "UNHANDLED_REJECTION"),
  });
});

// Chrome Side Panel API integration
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    log.info("side_panel.open.complete", { outcome: "success" });
  } catch (error) {
    log.warn("side_panel.open.complete", {
      outcome: "failure",
      errorCode: getSafeErrorCode(error, "SIDE_PANEL_OPEN_FAILED"),
    });
  }
});

// Enable side panel behavior
try {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
  log.info("side_panel.configuration.complete", { outcome: "success" });
} catch (error) {
  log.warn("side_panel.configuration.complete", {
    outcome: "failure",
    errorCode: getSafeErrorCode(error, "SIDE_PANEL_UNSUPPORTED"),
  });
}

log.info("runtime.loaded", { outcome: "success" });

// Export for testing (if needed)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    handleGenerateRequest,
    makeAPIRequest,
    checkUsageLimit,
    logUsage,
  };
}
