import {
  buildApplicationAuthDraft,
  saveApplicationAuthDraft,
} from "../lib/application-auth-draft.js";
import { isValidOperationId } from "../lib/logger-core.js";
import {
  filterOwnedAccepted,
  getOwnedUsage,
  isMatchingAccountToken,
  isOwnedRecord,
} from "../lib/account-owned-cache.js";
// Aletheia Extension Background Service Worker
// Handles API communication with the Aletheia backend

import {
  authAccountChanged,
  clearAuth,
  recoverGenerationSession,
  getAuthSnapshot,
  getAletheiaRequestHeaders,
  getAuthStatus,
  getValidAccessToken,
  handleAuthBridgeSession,
  isTokenValid,
  matchesPendingLogin,
  proactiveRefresh,
  recoverWebSession,
  restorePopupSession,
  waitForLogin,
} from "./auth.js";
import {
  buildGenerationRequestData,
  EVIDENCE_ENDPOINT,
  generationEndpoint,
  parseEvidenceChoices,
  serializeGenerationError,
} from "./generation-core.js";
import { normalizeMessageFocus } from "../lib/message-focus.js";
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
// Serialize local usage writes so overlapping generations cannot replace one
// another's counters. The epoch invalidates responses from before logout.
let usageMutation = Promise.resolve();
let usageEpoch = 0;
let personalStorageMutation = Promise.resolve();
let logoutInProgress = false;
let focusAccountRevision = 0;

chrome.storage.onChanged.addListener((changes, area) => {
  const auth = area === "local" ? changes.aletheia_auth : undefined;
  if (auth && auth.oldValue?.user?.id !== auth.newValue?.user?.id)
    focusAccountRevision++;
});

// Recover from service worker restart during login
(async function recoverPendingLogin() {
  const expected = await getAuthSnapshot();
  const { _loginPending } = await chrome.storage.local.get("_loginPending");
  if (!_loginPending) return;

  const { apiUrl, tabId, timeoutAt } = _loginPending;
  if (Date.now() > timeoutAt || !matchesPendingLogin(_loginPending, expected)) {
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
    await recoverWebSession(apiUrl, undefined, expected, {
      ownerId: _loginPending.ownerId,
    });
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
  if (alarm.name === "application-auth-draft-expiry") {
    const { applicationAuthDraft } = await chrome.storage.session.get(
      "applicationAuthDraft",
    );
    if (!applicationAuthDraft || applicationAuthDraft.expiresAt <= Date.now())
      await chrome.storage.session.remove("applicationAuthDraft");
    return;
  }
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
    const expected = await getAuthSnapshot();
    const { _loginPending } = await chrome.storage.local.get("_loginPending");
    if (!_loginPending) return;

    if (
      Date.now() > _loginPending.timeoutAt ||
      !matchesPendingLogin(_loginPending, expected)
    ) {
      log.info("auth.keepalive.complete", {
        stage: "auth.keepalive",
        outcome: "expired",
      });
      await chrome.storage.local.remove("_loginPending");
      chrome.alarms.clear("aletheia-login-keepalive");
      return;
    }

    try {
      await recoverWebSession(_loginPending.apiUrl, undefined, expected, {
        ownerId: _loginPending.ownerId,
      });
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

  if (message.action === "getMessageFocusCapability") {
    if (!isStoryPickerSender(sender)) {
      sendResponse({ messageFocus: false });
      return false;
    }
    getEffectiveApiUrl()
      .then((url) =>
        makeAPIRequest(
          "/api/extension/config",
          { cache: "no-store", redirect: "error" },
          url,
          operationId,
          { maxAttempts: 1, timeoutMs: 5000 },
        ),
      )
      .then((config) =>
        sendResponse({
          messageFocus: config.capabilities?.messageFocus === true,
        }),
      )
      .catch(() => sendResponse({ messageFocus: false }));
    return true;
  }

  if (message.action === "listEvidence") {
    if (!isStoryPickerSender(sender)) {
      sendResponse({ success: false, code: "EVIDENCE_LIST_UNAVAILABLE" });
      return false;
    }
    handleEvidenceList(message.requesterId, operationId).then(sendResponse);
    return true;
  }

  if (message.action === "generate") {
    if (
      (message.payload?.selectedEvidenceIds?.length ||
        message.payload?.messageFocus !== undefined) &&
      !isStoryPickerSender(sender)
    ) {
      sendResponse({ success: false, code: "EVIDENCE_SELECTION_UNAVAILABLE" });
      return false;
    }
    const focus = normalizeMessageFocus(message.payload?.messageFocus);
    if (
      focus === null ||
      (message.payload?.category === "yc_application" &&
        message.payload?.messageFocus !== undefined)
    ) {
      sendResponse({
        success: false,
        code: "INVALID_REQUEST",
        message: "Enter a valid Message focus.",
      });
      return false;
    }
    const payload =
      message.payload?.messageFocus === undefined
        ? message.payload
        : { ...message.payload, messageFocus: focus || undefined };
    handleGenerateRequest(
      payload,
      operationId,
      message.requesterId,
      message.focusTarget,
    )
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

  if (message.action === "saveAccountRecord") {
    saveAccountRecord(message.kind, message.requesterId, message.record)
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
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
    const epoch = usageEpoch;
    (async () => {
      try {
        const expected = await getAuthSnapshot();
        if (!logoutInProgress && epoch === usageEpoch) {
          await restorePopupSession(
            await getEffectiveApiUrl(),
            operationId,
            expected,
          );
        }
        log.info("auth.silent_check.complete", {
          operationId,
          outcome: "success",
        });
      } catch (error) {
        log.info("auth.silent_check.complete", {
          operationId,
          outcome: "failure",
          errorCode: getSafeErrorCode(error, "AUTH_REQUIRED"),
        });
      }
      return getAuthStatus();
    })().then(sendResponse, () => sendResponse({ authenticated: false }));
    return true;
  }

  // Auth bridge: content script on login page found the Supabase session
  if (message.action === "authBridgeSession") {
    log.info("auth.bridge.received", { operationId });
    handleAuthBridgeSession(message.session, operationId, sender.tab?.id);
    sendResponse({ success: true });
    return true;
  }

  // Acknowledge only after persistence; the modal retains unsaved reports.
  if (message.action === "sendFeedback") {
    handleFeedbackRequest(message.payload, message.requesterId, operationId)
      .then(() => {
        sendResponse({ success: true });
        log.info("feedback.dispatch.complete", {
          operationId,
          outcome: "success",
        });
      })
      .catch((error) => {
        const code = getSafeErrorCode(error, "FEEDBACK_DISPATCH_FAILED");
        sendResponse({
          success: false,
          code,
          error: "Feedback could not be saved. Please retry.",
        });
        log.warn("feedback.dispatch.complete", {
          operationId,
          outcome: "failure",
          errorCode: code,
        });
      });
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
      maxDailyUsage: 30,
    },
  };

  await chrome.storage.local.set(defaults);
  log.info("settings.initialized", { outcome: "success" });
}

async function handleAuthenticate(
  operationId,
  webOwnerId = null,
  expected,
  epoch = usageEpoch,
) {
  const url = await getEffectiveApiUrl();
  if (logoutInProgress || epoch !== usageEpoch) throw authAccountChanged();
  expected ??= await getAuthSnapshot();
  const complete = startExtensionTimedStage(log, "auth.interactive", {
    operationId,
  });

  // First try: maybe the user is already logged in (cookies exist)
  try {
    await getValidAccessToken(url, { operationId, webOwnerId, expected });
    const status = await getAuthStatus();
    if (logoutInProgress || epoch !== usageEpoch) throw authAccountChanged();
    complete("success", { authSource: "stored_session" });
    return {
      success: true,
      user: status.user,
      message: "Connected to Aletheia",
    };
  } catch (error) {
    if (error.code === "AUTH_ACCOUNT_CHANGED") throw error;
    if (logoutInProgress || epoch !== usageEpoch) throw authAccountChanged();
    // No existing session — open login tab and wait for cookies
  }

  // Second try: open login page and wait for the user to authenticate
  try {
    const sessionData = await waitForLogin(url, operationId, webOwnerId);
    complete("success", { authSource: "interactive_login" });
    return {
      success: true,
      user: sessionData.user,
      message: "Connected to Aletheia",
    };
  } catch (waitError) {
    await chrome.storage.session.remove("applicationAuthDraft");
    await chrome.alarms.clear("application-auth-draft-expiry");
    complete("failure", {
      errorCode: getSafeErrorCode(waitError, "AUTHENTICATION_FAILED"),
    });
    if (waitError.code === "AUTH_ACCOUNT_CHANGED") throw waitError;
    throw new Error(waitError.message || "Login failed. Please try again.");
  }
}

async function handleLogout(operationId) {
  usageEpoch++;
  logoutInProgress = true;
  const complete = startExtensionTimedStage(log, "auth.logout", {
    operationId,
  });
  try {
    await clearAuth();
    await usageMutation;
    await personalStorageMutation;
    await chrome.storage.local.remove([
      "accepted",
      "lastGeneration",
      "dailyUsage",
      "categoryUsage",
      "usageOwnerId",
    ]);
    await chrome.storage.session.remove("applicationAuthDraft");
    await chrome.alarms.clear("application-auth-draft-expiry");
    complete("success");
    return { success: true, message: "Disconnected from Aletheia" };
  } catch (error) {
    complete("failure", {
      errorCode: getSafeErrorCode(error, "LOGOUT_FAILED"),
    });
    throw error;
  } finally {
    logoutInProgress = false;
  }
}

async function saveAccountRecord(kind, requesterId, record) {
  if (
    logoutInProgress ||
    !requesterId ||
    record?.ownerId !== requesterId ||
    (kind !== "accepted" && kind !== "lastGeneration")
  ) {
    throw new Error("The connected account changed.");
  }
  const writeEpoch = usageEpoch;
  const pending = personalStorageMutation.then(async () => {
    const { aletheia_auth: auth, accepted = [] } =
      await chrome.storage.local.get(["aletheia_auth", "accepted"]);
    if (
      logoutInProgress ||
      writeEpoch !== usageEpoch ||
      auth?.user?.id !== requesterId
    ) {
      throw new Error("The connected account changed.");
    }
    if (kind === "accepted") {
      const recentAccepted = (Array.isArray(accepted) ? accepted : [])
        .filter((item) => isOwnedRecord(item, requesterId))
        .concat(record)
        .slice(-20);
      await chrome.storage.local.set({ accepted: recentAccepted });
    } else {
      await chrome.storage.local.set({ lastGeneration: record });
    }
  });
  personalStorageMutation = pending.catch(() => {});
  await pending;
}

async function handleFeedbackRequest(payload, requesterId, operationId) {
  const url = await getEffectiveApiUrl();
  const accessToken = await getValidAccessToken(url, { operationId });
  const { aletheia_auth } = await chrome.storage.local.get("aletheia_auth");
  if (!isMatchingAccountToken(requesterId, accessToken, aletheia_auth)) {
    throw new Error("The connected account changed. Reopen the extension.");
  }
  const response = await fetch(`${url}/api/extension/feedback`, {
    method: "POST",
    headers: getAletheiaRequestHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = new Error("Feedback persistence failed");
    if (response.status === 409) {
      const body = await response.json().catch(() => null);
      if (body?.code === "FEEDBACK_ALREADY_RECORDED") error.code = body.code;
    }
    throw error;
  }
}

function isStoryPickerSender(sender) {
  return (
    sender.id === chrome.runtime.id &&
    sender.url === chrome.runtime.getURL("popup/popup.html")
  );
}

async function readStoryAccount(requesterId, epoch) {
  const { aletheia_auth: auth } =
    await chrome.storage.local.get("aletheia_auth");
  if (
    !requesterId ||
    auth?.user?.id !== requesterId ||
    logoutInProgress ||
    epoch !== usageEpoch
  ) {
    const error = new Error(
      "The connected account changed. Reopen the extension and try again.",
    );
    error.code = "AUTH_ACCOUNT_CHANGED";
    throw error;
  }
  return auth;
}

async function readStoryAccessToken(requesterId, epoch, focused = false) {
  const auth = await readStoryAccount(requesterId, epoch);
  // These new paths only read auth. An asynchronous refresh could replace a
  // different account's session while a story request is in progress.
  if (!isTokenValid(auth)) {
    const error = new Error(
      focused
        ? "Reconnect to Aletheia, then re-enter Message focus."
        : "Please reconnect the extension to use selected stories.",
    );
    error.code = "AUTH_REQUIRED";
    error.status = 401;
    throw error;
  }
  return auth.access_token;
}

async function handleEvidenceList(requesterId, operationId) {
  const epoch = usageEpoch;
  try {
    const url = await getEffectiveApiUrl();
    const accessToken = await readStoryAccessToken(requesterId, epoch);
    const assertOwner = () => readStoryAccount(requesterId, epoch);
    const data = await makeAPIRequest(
      EVIDENCE_ENDPOINT,
      {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      url,
      operationId,
      { maxAttempts: 1, timeoutMs: 10000, assertBeforeAttempt: assertOwner },
    );
    await assertOwner();
    const evidence = parseEvidenceChoices(data.evidence);
    if (evidence) return { success: true, evidence };
  } catch (error) {
    if ([404, 405].includes(error.status))
      return { success: false, code: "EVIDENCE_SELECTION_UNSUPPORTED" };
    if (error.status === 401) return { success: false, code: "AUTH_REQUIRED" };
  }
  return { success: false, code: "EVIDENCE_LIST_UNAVAILABLE" };
}

async function handleGenerateRequest(
  payload,
  operationId,
  requesterId,
  focusTarget,
) {
  const generationUsageEpoch = usageEpoch;
  const focused = Boolean(payload.messageFocus);
  const accountRevision = focused ? focusAccountRevision : 0;
  const assertFocusAccount = () => {
    if (
      logoutInProgress ||
      generationUsageEpoch !== usageEpoch ||
      accountRevision !== focusAccountRevision
    )
      throw authAccountChanged();
  };
  const complete = startExtensionTimedStage(log, "generation.workflow", {
    operationId,
  });
  try {
    const url = await getEffectiveApiUrl();
    const { aletheia_auth } = await chrome.storage.local.get("aletheia_auth");

    const explicit = payload.selectedEvidenceIds?.length > 0;
    if (focused && new URL(url).protocol !== "https:")
      return { success: false, code: "MESSAGE_FOCUS_UNAVAILABLE" };
    const assertFocusTarget = async () => {
      if (!payload.messageFocus) return;
      const tab = Number.isInteger(focusTarget?.id)
        ? await chrome.tabs.get(focusTarget.id).catch(() => null)
        : null;
      if (!tab?.active || tab.url !== focusTarget.url) {
        const error = new Error(
          "The active profile changed. Review the context and generate again.",
        );
        error.code = "MESSAGE_FOCUS_CONTEXT_CHANGED";
        throw error;
      }
    };
    const getGenerationAuth = async () => {
      const expected = await getAuthSnapshot();
      if (
        logoutInProgress ||
        generationUsageEpoch !== usageEpoch ||
        (expected.auth?.user?.id && expected.auth.user.id !== requesterId)
      ) {
        throw authAccountChanged();
      }
      return expected;
    };
    const workflow = {
      resumeAfterInteractive: payload.category !== "yc_application",
      // Keep session exchange in the recovery state machine: a generation has
      // one silent exchange, rather than an implicit fetch on every token read.
      getAccessToken: async () =>
        getValidAccessToken(url, {
          allowSessionFetch: false,
          operationId,
          expected: await getGenerationAuth(),
        }),
      recoverSilently: async () =>
        recoverGenerationSession(
          url,
          operationId,
          await getGenerationAuth(),
          requesterId,
        ),
      clearAuth: async () => clearAuth(await getGenerationAuth()),
      authenticateInteractively: async () => {
        const expected = await getGenerationAuth();
        if (payload.category === "yc_application") {
          await saveApplicationAuthDraft(
            buildApplicationAuthDraft({
              category: payload.category,
              jd: payload.jd,
              questions: Array.isArray(payload.questions)
                ? payload.questions.join("\n")
                : payload.question,
              ownerId: aletheia_auth?.user?.id ?? null,
            }),
            chrome.storage.session,
            chrome.alarms,
          );
        }
        return handleAuthenticate(
          operationId,
          requesterId,
          expected,
          generationUsageEpoch,
        );
      },
      generate: async (accessToken) => {
        const { accepted = [], aletheia_auth: requestAuth } =
          await chrome.storage.local.get(["accepted", "aletheia_auth"]);
        if (!isMatchingAccountToken(requesterId, accessToken, requestAuth)) {
          const accountError = new Error(
            "The connected account changed. Reopen the extension and try again.",
          );
          accountError.code = "AUTH_ACCOUNT_CHANGED";
          throw accountError;
        }
        const relevantExamples = filterOwnedAccepted(
          accepted,
          payload.category,
          requesterId,
        );
        const requestData = buildGenerationRequestData(
          payload,
          relevantExamples,
        );
        const endpoint = generationEndpoint(requestData);
        const result = await makeAPIRequest(
          endpoint,
          {
            method: "POST",
            ...(explicit || focused ? { redirect: "error" } : {}),
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(requestData),
          },
          url,
          operationId,
          {
            // A repeated POST may reach the model again after an ambiguous
            // network failure. The server charges every model start.
            maxAttempts: 1,
            ...(payload.category === "yc_application"
              ? { timeoutMs: 120000 }
              : {}),
            assertBeforeAttempt: async () => {
              const activeAuth =
                explicit || focused
                  ? await readStoryAccount(requesterId, generationUsageEpoch)
                  : (await chrome.storage.local.get("aletheia_auth"))
                      .aletheia_auth;
              if (
                !isMatchingAccountToken(requesterId, accessToken, activeAuth)
              ) {
                const error = new Error(
                  "The connected account changed. Reopen the extension and try again.",
                );
                error.code = "AUTH_ACCOUNT_CHANGED";
                throw error;
              }
              if (focused) {
                await assertFocusTarget();
                assertFocusAccount();
              }
            },
          },
        ).catch((error) => {
          if (
            endpoint === EVIDENCE_ENDPOINT &&
            [404, 405].includes(error.status)
          ) {
            const unavailable = new Error(
              "This server cannot generate with selected stories. Clear your selection to generate automatically.",
            );
            unavailable.code = "EVIDENCE_SELECTION_UNSUPPORTED";
            throw unavailable;
          }
          throw error;
        });

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
    };
    // Reconnection can invalidate an explicit story or recipient-bound focus.
    const response =
      explicit || focused
        ? await workflow.generate(
            await readStoryAccessToken(
              requesterId,
              generationUsageEpoch,
              focused,
            ),
          )
        : await generateWithAuthRecovery(workflow);
    if (explicit || focused)
      await readStoryAccount(requesterId, generationUsageEpoch);
    if (focused) {
      await assertFocusTarget();
      assertFocusAccount();
      if (response.success && response.selectionStatus !== "matched") {
        return {
          success: false,
          code: "MESSAGE_FOCUS_UNAVAILABLE",
          message: "Clear Message focus to use automatic generation.",
        };
      }
    }

    if (!response.success) {
      complete("failure", {
        category: payload.category,
        errorCode: response.code,
      });
      return response;
    }
    if (response.serverQuota && requesterId) {
      await chrome.storage.local.set({
        serverQuota: {
          ...response.serverQuota,
          ownerId: requesterId,
          observedAt: Date.now(),
        },
      });
    }
    await logUsage(payload.category, requesterId, generationUsageEpoch);
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
  policy = {},
) {
  const url = (baseUrl || CONFIG.DEFAULT_API_URL) + endpoint;
  let lastError;
  const maxAttempts = policy.maxAttempts ?? CONFIG.MAX_RETRIES;
  const timeoutMs = policy.timeoutMs ?? CONFIG.TIMEOUT;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStartedAt = Date.now();
    let attemptRequestId;
    let timeoutId;
    try {
      log.info("api.request.start", {
        operationId,
        attempt,
        maxAttempts,
        method: options.method || "GET",
        endpoint,
      });

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      await policy.assertBeforeAttempt?.();

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
        apiError.retryAfterSeconds = Number(
          response.headers.get("Retry-After"),
        );
        apiError.code = errorBody?.code;
        apiError.requestId = response.headers.get("x-request-id") || undefined;
        apiError.authCause = errorBody?.cause;
        apiError.updateUrl = errorBody?.chromeWebStoreUrl;
        apiError.apiResponse = errorBody;
        throw apiError;
      }

      const data = await response.json();
      const limit = Number(response.headers.get("X-RateLimit-Limit"));
      const remaining = Number(response.headers.get("X-RateLimit-Remaining"));
      const resetTime = Number(response.headers.get("X-RateLimit-Reset"));
      const serverQuota =
        Number.isInteger(limit) &&
        limit > 0 &&
        limit <= 100 &&
        Number.isInteger(remaining) &&
        remaining >= 0 &&
        remaining <= limit &&
        Number.isSafeInteger(resetTime) &&
        resetTime > Date.now()
          ? { limit, remaining, resetTime }
          : undefined;
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
        ...(serverQuota ? { serverQuota } : {}),
        requestId: response.headers.get("x-request-id") || undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
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
        throw new Error(
          policy.maxAttempts === 1
            ? "Connection timed out; generation outcome is unknown. Check your credits before retrying."
            : "Request timeout. Please try again.",
        );
      }

      if (
        ["AUTH_ACCOUNT_CHANGED", "MESSAGE_FOCUS_CONTEXT_CHANGED"].includes(
          error.code,
        )
      )
        throw error;

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

      if (attempt < maxAttempts) {
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

async function logUsage(category, ownerId, generationEpoch = usageEpoch) {
  try {
    if (!ownerId) return;
    const pending = usageMutation.then(async () => {
      if (generationEpoch !== usageEpoch) return;
      const {
        dailyUsage: storedDaily,
        categoryUsage: storedCategory,
        usageOwnerId,
        aletheia_auth: activeAuth,
      } = await chrome.storage.local.get([
        "dailyUsage",
        "categoryUsage",
        "usageOwnerId",
        "aletheia_auth",
      ]);
      if (generationEpoch !== usageEpoch || activeAuth?.user?.id !== ownerId) {
        return;
      }
      const dailyUsage = {
        ...getOwnedUsage(storedDaily, usageOwnerId, ownerId),
      };
      const categoryUsage = {
        ...getOwnedUsage(storedCategory, usageOwnerId, ownerId),
      };

      const today = new Date().toISOString().split("T")[0];

      dailyUsage[today] = (dailyUsage[today] || 0) + 1;

      if (!categoryUsage[today]) {
        categoryUsage[today] = {};
      }
      categoryUsage[today][category] =
        (categoryUsage[today][category] || 0) + 1;

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

      await chrome.storage.local.set({
        dailyUsage,
        categoryUsage,
        usageOwnerId: ownerId,
      });
    });
    usageMutation = pending.catch(() => {});
    await pending;
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
    logUsage,
  };
}
