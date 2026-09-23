import { saveApplicationAuthDraft } from "../lib/application-auth-draft.js";
import { isValidOperationId } from "../lib/logger-core.js";
// Aletheia Extension Popup JavaScript
// Main UI logic and user interaction handlers

import {
  YC_APPLICATION_CATEGORY,
  projectStoredApplication,
  buildApplicationFeedback,
  parseApplicationQuestions,
  buildApplicationAuthDraft,
  readApplicationAuthDraft,
  APPLICATION_AUTH_DRAFT_KEY,
  buildGeneratePayload,
  calculateCharCount,
  getCategoryUiState,
  getGenerationErrorPresentation,
  isAuthError,
  parseGenerationResponse,
  validateGenerationInput,
} from "./popup-core.js";
import { createExtensionLogger, createOperationId } from "../lib/logger.js";
import {
  formatGenerationElapsed,
  getGenerationProgress,
} from "./generation-progress.js";
import { startGenerationOrb } from "./generation-orb.js";

let currentProfile = null;
let currentOutput = null;
let currentUserId = null;
let popupAuthenticated = false;
let feedbackOutput = null;
const BACKGROUND_UNAVAILABLE_CODE = "BACKGROUND_UNAVAILABLE";
const DEFAULT_API_URL = "https://www.aletheia.live";
const PROFILE_EXTRACTION_CONSENT_KEY = "profileExtractionConsent";
let profileMonitoringStarted = false;
const log = createExtensionLogger("popup");
let generationProgressTimer = null;
let generationProgressStartedAt = 0;
let generationProgressPhase = "preparing";
let generationOrb = null;
let generationOrbRun = 0;

function normalizeApiUrl(apiUrl) {
  let value = String(apiUrl || "").trim();
  while (value.endsWith("/") && !value.endsWith("://")) {
    value = value.slice(0, -1);
  }
  return value;
}

async function getConfiguredApiUrl() {
  const [{ apiBaseUrl }, { apiUrl }] = await Promise.all([
    chrome.storage.sync.get("apiBaseUrl"),
    chrome.storage.local.get("apiUrl"),
  ]);

  return normalizeApiUrl(apiBaseUrl || apiUrl || DEFAULT_API_URL);
}

function sendBackgroundMessage(message) {
  const operationId = createOperationId(message.operationId);
  const correlatedMessage = { ...message, operationId };
  log.info("runtime.message.start", { operationId, action: message.action });
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(correlatedMessage, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError || response === undefined) {
          const detail =
            runtimeError?.message ||
            "The background worker returned no response.";
          log.error("runtime.message.failure", {
            operationId,
            action: message.action,
            errorCode: BACKGROUND_UNAVAILABLE_CODE,
          });
          resolve({
            success: false,
            authenticated: false,
            code: BACKGROUND_UNAVAILABLE_CODE,
            error:
              "The extension background service is unavailable. Reload the extension and try again.",
          });
          return;
        }
        log.info("runtime.message.complete", {
          operationId,
          action: message.action,
          outcome: response?.success === false ? "failure" : "success",
          errorCode: response?.code,
        });
        resolve({ ...response, operationId });
      });
    } catch (error) {
      log.error("runtime.message.failure", {
        operationId,
        action: message.action,
        errorCode: BACKGROUND_UNAVAILABLE_CODE,
      });
      resolve({
        success: false,
        authenticated: false,
        code: BACKGROUND_UNAVAILABLE_CODE,
        error:
          "The extension background service is unavailable. Reload the extension and try again.",
      });
    }
  });
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  if (await hasProfileExtractionConsent()) {
    await startProfileWorkflow();
  } else {
    showProfileConsent();
  }

  // React to auth state changes (e.g., auth-bridge stores session while popup is open).
  // Full reload is the safest path: showAuthRequired() may have wiped #mainContent
  // contents, so a fresh DOM is needed to restore #jdInput, #category, etc.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PROFILE_EXTRACTION_CONSENT_KEY]) {
      if (changes[PROFILE_EXTRACTION_CONSENT_KEY].newValue !== true) {
        currentProfile = null;
        showProfileConsent(
          "Profile reading is off. You can re-enable it from here at any time.",
        );
      }
    }

    if (area === "local" && changes.aletheia_auth) {
      const before = changes.aletheia_auth.oldValue;
      const after = changes.aletheia_auth.newValue;
      if (before?.access_token && !after?.access_token) {
        currentOutput = null;
        document.getElementById("output")?.classList.add("hidden");
      }
      // Only reload on transition into authenticated state — avoid reload
      // loops when the SW writes the same auth back on a refresh tick.
      if (!before?.access_token && after?.access_token) {
        console.log(
          "[POPUP] Auth state changed → authenticated, reloading popup",
        );
        window.location.reload();
      }
    }
  });
});

async function hasProfileExtractionConsent() {
  const stored = await chrome.storage.local.get(PROFILE_EXTRACTION_CONSENT_KEY);
  return stored[PROFILE_EXTRACTION_CONSENT_KEY] === true;
}

function showProfileConsent(statusMessage = "") {
  document.getElementById("profileConsent")?.classList.remove("hidden");
  document.getElementById("readingProfile").style.display = "none";
  document.getElementById("profileBanner")?.classList.add("hidden");
  document.getElementById("noProfile")?.classList.add("hidden");
  document.getElementById("mainContent")?.classList.add("hidden");
  document.getElementById("consentStatus").textContent = statusMessage;
}

async function startProfileWorkflow() {
  document.getElementById("profileConsent")?.classList.add("hidden");
  await initializePopup();
  await checkLinkedInProfile();
  startProfileMonitoring();
}

function startProfileMonitoring() {
  if (profileMonitoringStarted) return;
  profileMonitoringStarted = true;

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") checkLinkedInProfile();
  });
  chrome.tabs.onActivated.addListener(() => checkLinkedInProfile());
}

async function initializePopup() {
  console.log("[POPUP] initializePopup: checking auth status...");
  // Check auth status from storage first
  let authStatus = await sendBackgroundMessage({ action: "getAuthStatus" });
  log.info("auth.status", {
    authenticated: Boolean(authStatus?.authenticated),
  });

  // If not authenticated in storage, silently try to detect an existing web app session
  // (handles: logged in via web app, logged in from another window, etc.)
  if (
    !authStatus?.authenticated &&
    authStatus?.code !== BACKGROUND_UNAVAILABLE_CODE
  ) {
    console.log(
      "[POPUP] No stored auth, silently checking for existing web session...",
    );
    const silentResult = await sendBackgroundMessage({
      action: "silentAuthCheck",
    });
    log.info("auth.silent_check", {
      authenticated: Boolean(silentResult?.authenticated),
    });

    if (silentResult && silentResult.authenticated) {
      authStatus = silentResult;
    }
  }

  if (!authStatus || !authStatus.authenticated) {
    console.log("[POPUP] Not authenticated, showing auth required UI");
    showAuthRequired(authStatus);
    return;
  }

  popupAuthenticated = true;
  currentUserId = authStatus.user?.id ?? null;
  // Show connected user badge
  showUserBadge(authStatus.user);

  // Load usage stats
  await updateUsageStats();

  // Set up character counter for JD input
  setupCharacterCounter();

  document.getElementById("mainContent")?.classList.remove("hidden");

  // Restore last generation if available
  await restoreLastGeneration();
  await restoreAuthenticationDraft();
}

function setupEventListeners() {
  // Settings button
  document
    .getElementById("settingsBtn")
    .addEventListener("click", openSettings);
  document
    .getElementById("dashboardBtn")
    ?.addEventListener("click", openDashboard);

  // Refresh button
  document.getElementById("refreshBtn").addEventListener("click", () => {
    checkLinkedInProfile(true);
  });

  document
    .getElementById("consentContinue")
    ?.addEventListener("click", async () => {
      await chrome.storage.local.set({
        [PROFILE_EXTRACTION_CONSENT_KEY]: true,
      });
      await startProfileWorkflow();
    });
  document.getElementById("consentNotNow")?.addEventListener("click", () => {
    showProfileConsent(
      "Profile reading is off. Select Continue when you are ready.",
    );
  });

  // Generate button
  document
    .getElementById("generateBtn")
    ?.addEventListener("click", generateMessage);

  document
    .getElementById("regenerateApplicationBtn")
    ?.addEventListener("click", generateMessage);

  // Copy buttons
  document.addEventListener("click", handleCopyClick);

  // Auto-fill button
  document
    .getElementById("fillBtn")
    ?.addEventListener("click", autoFillMessage);

  // Feedback buttons
  document
    .getElementById("acceptBtn")
    ?.addEventListener("click", () =>
      handleFeedback("accept").catch((error) => showError(error.message)),
    );
  document
    .getElementById("rejectBtn")
    ?.addEventListener("click", showRejectReasonPicker);

  // Rejection reason buttons (delegated)
  document.getElementById("reject-reason")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".reason-btn");
    if (!btn) return;
    const reason = btn.getAttribute("data-reason");
    handleFeedback("reject", reason === "skip" ? undefined : reason).catch(
      (error) => showError(error.message),
    );
  });

  document
    .getElementById("feedbackCancel")
    ?.addEventListener("click", () =>
      document.getElementById("applicationFeedbackDialog").close(),
    );
  document
    .getElementById("applicationFeedbackDialog")
    ?.addEventListener("close", () => {
      feedbackOutput = null;
      document.getElementById("feedbackSummary").value = "";
      document.getElementById("rejectBtn")?.focus();
    });
  document
    .getElementById("applicationFeedbackForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = document.getElementById("feedbackSubmit");
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        if (!feedbackOutput || currentOutput !== feedbackOutput)
          throw new Error(
            "The answer changed. Reopen feedback for the current result.",
          );
        await handleFeedback(
          "reject",
          document.getElementById("feedbackCategory").value,
          document.getElementById("feedbackSummary").value,
        );
        document.getElementById("applicationFeedbackDialog").close();
      } catch (error) {
        document.getElementById("feedbackError").textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });

  // Category change handler
  document.getElementById("category")?.addEventListener("change", async () => {
    updateUIForCategory();
    await checkLinkedInProfile();
  });
  document
    .getElementById("emailMode")
    ?.addEventListener("change", updateUIForCategory);

  // JD input change handler
  document.getElementById("jdInput")?.addEventListener("input", () => {
    updateCharacterCount();
    updateGenerateAvailability();
  });
  document.getElementById("ycQuestionInput")?.addEventListener("input", () => {
    updateQuestionCharacterCount();
    updateGenerateAvailability();
  });
}

function showUserBadge(user) {
  const footer = document.querySelector(".footer");
  if (!footer) return;

  // Add user badge before usage stats
  const existingBadge = document.getElementById("userBadge");
  if (existingBadge) existingBadge.remove();

  const badge = document.createElement("div");
  badge.id = "userBadge";
  badge.className = "user-badge";

  const email = document.createElement("span");
  email.className = "user-email";
  email.textContent = user?.email || user?.full_name || "Connected";

  const disconnect = document.createElement("button");
  disconnect.id = "disconnectBtn";
  disconnect.className = "disconnect-btn";
  disconnect.title = "Disconnect";

  const svgNs = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svgNs, "svg");
  icon.setAttribute("class", "icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("width", "14");
  icon.setAttribute("height", "14");

  const path = document.createElementNS(svgNs, "path");
  path.setAttribute("d", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4");
  const polyline = document.createElementNS(svgNs, "polyline");
  polyline.setAttribute("points", "16,17 21,12 16,7");
  const line = document.createElementNS(svgNs, "line");
  line.setAttribute("x1", "21");
  line.setAttribute("y1", "12");
  line.setAttribute("x2", "9");
  line.setAttribute("y2", "12");

  icon.append(path, polyline, line);
  disconnect.appendChild(icon);
  badge.append(email, disconnect);

  footer.insertBefore(badge, footer.firstChild);

  document
    .getElementById("disconnectBtn")
    .addEventListener("click", async () => {
      const result = await sendBackgroundMessage({ action: "logout" });
      if (result?.success) {
        window.location.reload();
      }
    });
}

function showAuthRequired(authStatus) {
  // Show auth prompt instead of main content
  const mainContent = document.getElementById("mainContent");
  const setup = document.createElement("div");
  setup.className = "setup-required";

  const heading = document.createElement("h3");
  heading.textContent = "Connect to Aletheia";

  const description = document.createElement("p");
  description.textContent =
    "Log in to the Aletheia web app, then click the button below to connect this extension to your account.";

  const connect = document.createElement("button");
  connect.id = "connectBtn";
  connect.className = "action-btn primary";
  connect.textContent = "Connect to Aletheia";

  const settings = document.createElement("button");
  settings.id = "openSettingsBtn";
  settings.className = "action-btn secondary";
  settings.style.marginTop = "8px";
  settings.textContent = "Open Settings";

  const authError = document.createElement("div");
  authError.id = "authError";
  authError.className = "error-message hidden";
  authError.style.marginTop = "8px";

  const authErrorText = document.createElement("span");
  authErrorText.id = "authErrorText";
  authError.appendChild(authErrorText);

  if (authStatus?.code === BACKGROUND_UNAVAILABLE_CODE) {
    authErrorText.textContent = authStatus.error;
    authError.classList.remove("hidden");
  }

  setup.append(heading, description, connect, settings, authError);
  document.getElementById("authenticationSetup")?.remove();
  setup.id = "authenticationSetup";
  mainContent.prepend(setup);
  popupAuthenticated = false;
  document.getElementById("category").value = YC_APPLICATION_CATEGORY;
  document.getElementById("category").disabled = true;
  updateUIForCategory();
  mainContent.classList.remove("hidden");

  document.getElementById("connectBtn").addEventListener("click", async () => {
    const btn = document.getElementById("connectBtn");
    try {
      await persistAuthenticationDraft();
    } catch {
      showError(
        "Could not preserve your draft. Keep this window open and try connecting again.",
      );
      return;
    }
    btn.textContent = "Connecting...";
    btn.disabled = true;
    console.log(
      "[POPUP] Connect button clicked, sending authenticate message...",
    );

    // Poll auth status as fallback (in case sendResponse is lost due to SW restart)
    let authResolved = false;
    const authPollInterval = setInterval(async () => {
      try {
        const status = await sendBackgroundMessage({ action: "getAuthStatus" });
        if (status?.authenticated) {
          clearInterval(authPollInterval);
          if (!authResolved) {
            authResolved = true;
            console.log("[POPUP] Auth detected via polling");
            btn.textContent = "Connected!";
            setTimeout(() => window.location.reload(), 500);
          }
        }
      } catch (e) {
        // Service worker may be restarting, ignore
      }
    }, 2000);

    try {
      // The authenticate action may wait for the user to log in on the web app.
      // Show a "Waiting for login..." state after a brief delay.
      const waitingTimeout = setTimeout(() => {
        btn.textContent = "Waiting for login...";
      }, 2000);

      const result = await sendBackgroundMessage({ action: "authenticate" });
      log.info("auth.interactive_result", {
        outcome: result?.success ? "success" : "failure",
      });

      clearTimeout(waitingTimeout);

      if (authResolved) return; // Already handled by polling

      // SW was terminated while waiting (result is undefined/null).
      // Don't show error — let authPollInterval detect auth after SW recovery.
      if (!result) {
        chrome.storage.local.get("_loginPending", ({ _loginPending }) => {
          if (_loginPending && Date.now() < _loginPending.timeoutAt) {
            btn.textContent = "Waiting for login...";
            // authPollInterval is still running; it will detect auth and reload
            return;
          }
          // No pending login or it has timed out
          clearInterval(authPollInterval);
          btn.textContent = "Connect to Aletheia";
          btn.disabled = false;
          showError("Connection failed. Please try again.");
        });
        return;
      }

      authResolved = true;
      clearInterval(authPollInterval);

      if (result.success) {
        log.info("auth.connected", { outcome: "success" });
        btn.textContent = "Connected!";
        // Brief delay so user sees success before reload
        setTimeout(() => window.location.reload(), 500);
      } else {
        log.warn("auth.connect_failed", { errorCode: "AUTH_FAILED" });
        btn.textContent = "Connect to Aletheia";
        btn.disabled = false;
        const errorMsg = result.error?.includes("timed out")
          ? result.error
          : result.error || "Connection failed. Please try again.";
        showError(errorMsg);
      }
    } catch (error) {
      clearInterval(authPollInterval);
      if (authResolved) return;
      log.warn("auth.connect_failed", { errorCode: "AUTH_FAILED" });
      btn.textContent = "Connect to Aletheia";
      btn.disabled = false;
      showError("Connection failed. Please try again.");
    }
  });

  document
    .getElementById("openSettingsBtn")
    .addEventListener("click", openSettings);
}

async function checkLinkedInProfile(forceRefresh = false) {
  const readingBanner = document.getElementById("readingProfile");
  const refreshIcon = document.querySelector("#refreshBtn .refresh-icon");
  const category = document.getElementById("category")?.value;

  if (!(await hasProfileExtractionConsent())) {
    currentProfile = null;
    showProfileConsent();
    return;
  }

  if (category === YC_APPLICATION_CATEGORY) {
    readingBanner.style.display = "none";
    refreshIcon?.classList.remove("spinning");
    document.getElementById("profileBanner")?.classList.add("hidden");
    document.getElementById("noProfile")?.classList.add("hidden");
    document.getElementById("mainContent")?.classList.remove("hidden");
    updateGenerateAvailability();
    return;
  }

  // Reset banner state
  document.getElementById("profileBanner").classList.add("hidden");
  document.getElementById("noProfile").classList.add("hidden");
  readingBanner.style.display = "flex";
  refreshIcon?.classList.add("spinning");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url?.includes("linkedin.com/in/")) {
      readingBanner.style.display = "none";
      refreshIcon?.classList.remove("spinning");
      showNoProfile();
      return;
    }

    // Fix 6B: Content script retry — try sending, inject if not ready
    let response;
    const messageAction = forceRefresh ? "reextractProfile" : "getProfile";
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: messageAction,
      });
    } catch (err) {
      // Content script not injected — try injecting it, then retry once
      console.log("[POPUP] Content script not ready, injecting...");
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/linkedin-reader.js"],
        });
        await new Promise((r) => setTimeout(r, 1500));
        response = await chrome.tabs.sendMessage(tab.id, {
          action: "getProfile",
        });
      } catch (injectErr) {
        console.warn(
          "[POPUP] Content script injection failed:",
          injectErr.message,
        );
      }
    }

    readingBanner.style.display = "none";
    refreshIcon?.classList.remove("spinning");

    if (response?.success && response.profile?.name) {
      currentProfile = response.profile;
      showProfileDetected(response.profile);
      enableMainContent();
    } else {
      showNoProfile();
    }
  } catch (error) {
    console.error("Error checking LinkedIn profile:", error);
    readingBanner.style.display = "none";
    refreshIcon?.classList.remove("spinning");
    showNoProfile();
  }
}

function showProfileDetected(profile) {
  const banner = document.getElementById("profileBanner");
  const nameEl = document.getElementById("profileName");
  const roleEl = document.getElementById("profileRole");

  nameEl.textContent = profile.name;
  roleEl.textContent = profile.headline || "LinkedIn Member";

  banner.classList.remove("hidden");
  document.getElementById("noProfile").classList.add("hidden");
}

function showNoProfile() {
  currentProfile = null;
  document.getElementById("noProfile").classList.remove("hidden");
  document.getElementById("profileBanner").classList.add("hidden");
  document.getElementById("mainContent")?.classList.remove("hidden");
  updateGenerateAvailability();
}

function enableMainContent() {
  document.getElementById("mainContent")?.classList.remove("hidden");
  updateGenerateAvailability();
}

async function generateMessage() {
  const generationStartedAt = Date.now();
  const category = document.getElementById("category").value;
  const contextValue = document.getElementById("jdInput").value.trim();
  const questionValue = document
    .getElementById("ycQuestionInput")
    ?.value.trim();
  const validation = validateGenerationInput({
    category,
    hasProfile: Boolean(currentProfile),
    contextValue,
    questionValue,
  });

  if (!validation.valid) {
    showError(validation.message);
    return;
  }

  if (!popupAuthenticated) {
    document.getElementById("connectBtn")?.click();
    return;
  }
  const operationId = createOperationId();
  let generationCompleted = false;
  let generationOutcome = "failure";
  let generationRequestId;
  let clientVersion;
  try {
    clientVersion = chrome.runtime?.getManifest?.().version;
  } catch {
    /* Optional diagnostic metadata. */
  }
  try {
    log.info("generation.start", { operationId, category, clientVersion });
    setGeneratingState(true);

    const intent = document.getElementById("intent").value;
    const emailMode =
      document.getElementById("emailMode")?.value || "initial_outreach";

    const { accepted = [] } = await chrome.storage.local.get(["accepted"]);

    const relevantExamples = accepted
      .filter((item) => item.category === category)
      .map((item) => item.body)
      .slice(-3);

    const payload = buildGeneratePayload(
      currentProfile,
      null,
      contextValue,
      category,
      intent,
      relevantExamples,
      emailMode,
      questionValue,
    );

    setGenerationPhase("generating");
    const response = await sendBackgroundMessage({
      action: "generate",
      payload,
      operationId,
    });

    if (response.success) {
      const validatedResponse = parseGenerationResponse(
        response,
        payload.questions,
      );
      displayOutput(validatedResponse);
      generationCompleted = true;
      generationRequestId = isValidOperationId(response.requestId)
        ? response.requestId.toLowerCase()
        : undefined;
      log.info("generation.complete", {
        operationId,
        category,
        outcome: "success",
        durationMs: Math.max(0, Date.now() - generationStartedAt),
        requestId: response.requestId,
        clientVersion,
      });
      await storeGeneration(validatedResponse);
      await incrementUsageCount();
      generationOutcome = "success";
    } else {
      generationCompleted = true;
      log.warn("generation.complete", {
        operationId,
        category,
        outcome: "failure",
        durationMs: Math.max(0, Date.now() - generationStartedAt),
        errorCode: response.code,
        status: response.status,
      });
      const presentation = getGenerationErrorPresentation(response);
      const errMsg = presentation.message;
      if (isAuthError(errMsg)) {
        await persistAuthenticationDraft();
        showAuthRequired();
        showAuthError(errMsg);
      } else {
        showGenerationError(presentation);
      }
    }
  } catch (error) {
    if (!generationCompleted) {
      log.warn("generation.complete", {
        operationId,
        category,
        outcome: "failure",
        durationMs: Math.max(0, Date.now() - generationStartedAt),
        errorCode: "GENERATION_CLIENT_FAILED",
      });
    }
    const errMsg =
      error.message ||
      "Network error. Please check your connection and try again.";
    if (isAuthError(errMsg)) {
      showAuthError(errMsg);
    } else {
      showError("Network error. Please check your connection and try again.");
    }
  } finally {
    setGeneratingState(false);
    try {
      log.info("generation.finished", {
        operationId,
        requestId: generationRequestId,
        category,
        clientVersion,
        outcome: generationOutcome,
        durationMs: Math.max(0, Date.now() - generationStartedAt),
      });
    } catch {
      /* Local diagnostics cannot prevent spinner recovery. */
    }
  }
}

function displayOutput(output) {
  const outputSection = document.getElementById("output");
  const messageText = document.getElementById("messageText");
  const subjectLine = document.getElementById("subjectLine");
  const subjectText = document.getElementById("subjectText");

  const processedOutput = parseGenerationResponse(output);
  const application = processedOutput.category === YC_APPLICATION_CATEGORY;
  document.getElementById("rejectLabel").textContent = application
    ? "Report issue"
    : "Regenerate";
  document
    .getElementById("regenerateApplicationBtn")
    .classList.toggle("hidden", !application);
  currentOutput = processedOutput;

  const messageBody = processedOutput.body || processedOutput.message || "";
  messageText.replaceChildren();
  if (
    processedOutput.category === YC_APPLICATION_CATEGORY &&
    processedOutput.answers
  ) {
    for (const [index, answer] of processedOutput.answers.entries()) {
      const section = document.createElement("section");
      section.className = "application-answer";
      const heading = document.createElement("h3");
      heading.id = `answer-heading-${answer.questionId}`;
      heading.textContent = answer.question || `Answer ${index + 1}`;
      section.setAttribute("aria-labelledby", heading.id);
      const body = document.createElement("p");
      body.textContent = answer.body;
      const copy = document.createElement("button");
      copy.className = "copy-btn";
      copy.type = "button";
      copy.dataset.copy = "answer";
      copy.dataset.answerId = answer.questionId;
      copy.setAttribute("aria-label", `Copy answer ${index + 1}`);
      copy.textContent = "Copy answer";
      section.append(heading, body, copy);
      messageText.append(section);
    }
  } else messageText.textContent = messageBody;

  updateCharacterCountDisplay(messageBody, processedOutput.category);
  if (processedOutput.answers) {
    const count = document.getElementById("messageCharCount");
    count.textContent = `${processedOutput.answers.length} answers · 50–150 words each`;
    count.className = "char-count-display";
    count.style.color = "";
    count.style.borderColor = "";
  }

  if (processedOutput.subject_line) {
    subjectText.textContent = processedOutput.subject_line;
    subjectLine.classList.remove("hidden");
  } else {
    subjectLine.classList.add("hidden");
  }

  displayValidationFeedback(processedOutput);

  outputSection.classList.remove("hidden");
  hideError();
  outputSection.focus({ preventScroll: true });
}

function updateCharacterCountDisplay(text, category) {
  const messageCharCount = document.getElementById("messageCharCount");

  if (!messageCharCount) return;

  const { displayText, isOverLimit, isNearLimit } = calculateCharCount(
    text,
    category,
  );

  messageCharCount.textContent = displayText;

  messageCharCount.className = "char-count-display";
  if (isOverLimit) {
    messageCharCount.classList.add("over-limit");
    messageCharCount.style.color = "var(--warning-400)";
    messageCharCount.style.borderColor = "var(--warning-400)";
  } else if (isNearLimit) {
    messageCharCount.classList.add("near-limit");
    messageCharCount.style.color = "var(--warning-500)";
    messageCharCount.style.borderColor = "var(--warning-500)";
  } else {
    messageCharCount.style.color = "var(--success-400)";
    messageCharCount.style.borderColor = "var(--success-400)";
  }
}

function setGeneratingState(isGenerating) {
  const generateBtn = document.getElementById("generateBtn");
  const generateText = document.getElementById("generateText");
  const progress = document.getElementById("generationProgress");

  generateBtn.disabled = isGenerating;
  generateBtn.setAttribute("aria-busy", String(isGenerating));
  for (const id of [
    "regenerateApplicationBtn",
    "acceptBtn",
    "rejectBtn",
    "jdInput",
    "ycQuestionInput",
    "emailMode",
    "intent",
  ]) {
    const control = document.getElementById(id);
    if (control) control.disabled = isGenerating;
  }
  document.getElementById("category").disabled =
    isGenerating || !popupAuthenticated;

  if (isGenerating) {
    generateText.textContent = "Generating...";
    generationProgressStartedAt = performance.now();
    generationProgressPhase = "preparing";
    progress?.classList.remove("hidden");
    updateGenerationProgress();
    clearInterval(generationProgressTimer);
    generationProgressTimer = setInterval(updateGenerationProgress, 1000);
    const run = ++generationOrbRun;
    startGenerationOrb(document.getElementById("generationOrb"), "weaving")
      .then((orb) => {
        if (run !== generationOrbRun) {
          orb.stop();
          return;
        }
        generationOrb = orb;
        orb.setState(
          getGenerationProgress(generationProgressPhase, 0).orbState,
        );
      })
      .catch(() => {
        // Text progress remains usable if canvas rendering is unavailable.
      });
  } else {
    ++generationOrbRun;
    clearInterval(generationProgressTimer);
    generationProgressTimer = null;
    generationOrb?.stop();
    generationOrb = null;
    progress?.classList.add("hidden");
    updateGenerateAvailability();
  }
}

function setGenerationPhase(phase) {
  generationProgressPhase = phase;
  updateGenerationProgress();
  generationOrb?.setState(
    getGenerationProgress(
      phase,
      performance.now() - generationProgressStartedAt,
    ).orbState,
  );
}

function updateGenerationProgress() {
  const elapsedMs = Math.max(
    0,
    performance.now() - generationProgressStartedAt,
  );
  const presentation = getGenerationProgress(
    generationProgressPhase,
    elapsedMs,
  );
  document.getElementById("generationProgressLabel").textContent =
    presentation.label;
  document.getElementById("generationProgressHint").textContent =
    presentation.hint;
  document.getElementById("generationElapsed").textContent =
    `${formatGenerationElapsed(elapsedMs)} elapsed`;
}

function handleCopyClick(event) {
  const copyBtn = event.target.closest(".copy-btn");
  if (!copyBtn) return;

  const copyType = copyBtn.getAttribute("data-copy");
  let textToCopy = "";

  if (copyType === "subject") {
    textToCopy = document.getElementById("subjectText").textContent;
  } else if (copyType === "body") {
    textToCopy = currentOutput?.body || "";
  } else if (copyType === "answer") {
    textToCopy =
      currentOutput?.answers?.find(
        (answer) => answer.questionId === copyBtn.dataset.answerId,
      )?.body || "";
  }

  if (textToCopy) {
    copyToClipboardWithFeedback(textToCopy, copyBtn, "Copied!");
  }
}

document.getElementById("copyAllBtn")?.addEventListener("click", () => {
  if (!currentOutput) return;

  let textToCopy = "";

  if (currentOutput.subject_line) {
    textToCopy = `Subject: ${currentOutput.subject_line}\n\n${currentOutput.body}`;
  } else {
    textToCopy = currentOutput.body;
  }

  copyToClipboardWithFeedback(
    textToCopy,
    document.getElementById("copyAllBtn"),
    "All Copied!",
  );
});

async function copyToClipboardWithFeedback(
  text,
  buttonElement,
  successMessage,
) {
  if (!text) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showCopySuccess(buttonElement, successMessage);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.cssText = `
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      padding: 0;
      border: none;
      outline: none;
      box-shadow: none;
      background: transparent;
    `;

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (successful) {
      showCopySuccess(buttonElement, successMessage);
    } else {
      throw new Error("Copy command failed");
    }
  } catch (error) {
    console.error("Copy failed:", error);
    showCopyError(buttonElement, "Copy failed");
  }
}

function showCopySuccess(buttonElement, message) {
  const originalNodes = Array.from(buttonElement.childNodes).map((node) =>
    node.cloneNode(true),
  );
  const originalIcon = buttonElement.querySelector(".copy-icon");

  buttonElement.classList.add("copy-success");
  if (originalIcon) {
    originalIcon.style.display = "none";
  }

  const successIcon = document.createElement("span");
  successIcon.textContent = "✓";
  successIcon.style.color = "var(--success-400)";
  buttonElement.appendChild(successIcon);

  const textElement =
    buttonElement.querySelector(".btn-icon") || buttonElement.firstChild;
  if (textElement && textElement.nodeType === 3) {
    textElement.textContent = message;
  } else {
    buttonElement.setAttribute("title", message);
  }

  setTimeout(() => {
    buttonElement.classList.remove("copy-success");
    if (originalIcon) {
      originalIcon.style.display = "";
    }
    if (successIcon.parentNode) {
      successIcon.remove();
    }

    if (textElement && textElement.nodeType === 3) {
      buttonElement.replaceChildren(
        ...originalNodes.map((node) => node.cloneNode(true)),
      );
    } else {
      buttonElement.replaceChildren(
        ...originalNodes.map((node) => node.cloneNode(true)),
      );
    }
  }, 1500);
}

function showCopyError(buttonElement, message) {
  const originalText = buttonElement.textContent;

  buttonElement.style.color = "var(--error-400)";
  buttonElement.textContent = message;

  setTimeout(() => {
    buttonElement.style.color = "";
    buttonElement.textContent = originalText;
  }, 2000);
}

async function autoFillMessage() {
  if (!currentOutput) return;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    await chrome.tabs.sendMessage(tab.id, {
      action: "autoFill",
      data: currentOutput,
    });

    showTemporaryFeedback(document.getElementById("fillBtn"), "Filled!");
  } catch (error) {
    console.error("Auto-fill error:", error);
    showError("Could not auto-fill. Make sure you're on the right page.");
  }
}

function showRejectReasonPicker() {
  if (currentOutput?.category === YC_APPLICATION_CATEGORY) {
    feedbackOutput = currentOutput;
    document.getElementById("feedbackSummary").value = "";
    document.getElementById("feedbackError").textContent = "";
    document.getElementById("applicationFeedbackDialog").showModal();
    return;
  }
  const rejectReason = document.getElementById("reject-reason");
  if (rejectReason) rejectReason.classList.remove("hidden");
}

async function handleFeedback(type, rejectionReason, summary) {
  if (!currentOutput) return;

  // Hide reason picker if visible
  document.getElementById("reject-reason")?.classList.add("hidden");

  const category = document.getElementById("category").value;
  if (currentOutput.category === YC_APPLICATION_CATEGORY) {
    const payload = buildApplicationFeedback(
      currentOutput,
      type === "accept",
      rejectionReason,
      summary,
    );
    const response = await chrome.runtime.sendMessage({
      action: "sendFeedback",
      payload,
    });
    if (!response?.success)
      throw new Error("Feedback could not be saved. Please retry.");
    if (type === "accept") await saveAcceptedMessage();
    showTemporaryFeedback(
      document.getElementById(type === "accept" ? "acceptBtn" : "rejectBtn"),
      "Saved!",
    );
    return;
  }
  const messageBody = currentOutput.body || currentOutput.message || "";

  const evalMetadata = currentOutput.evalMetadata || undefined;

  if (type === "accept") {
    await saveAcceptedMessage();
    showTemporaryFeedback(document.getElementById("acceptBtn"), "Saved!");
    chrome.runtime
      .sendMessage({
        action: "sendFeedback",
        payload: {
          message: messageBody,
          category,
          approved: true,
          subjectLine: currentOutput.subject_line || undefined,
          ...(evalMetadata ? { evalMetadata } : {}),
        },
      })
      .catch(() => {});
  } else if (type === "reject") {
    chrome.runtime
      .sendMessage({
        action: "sendFeedback",
        payload: {
          message: messageBody,
          category,
          approved: false,
          ...(rejectionReason ? { rejectionReason } : {}),
          ...(evalMetadata ? { evalMetadata } : {}),
        },
      })
      .catch(() => {});
    await generateMessage();
  }
}

async function saveAcceptedMessage() {
  const { accepted = [] } = await chrome.storage.local.get("accepted");

  const feedbackData = {
    ...(currentOutput.category === YC_APPLICATION_CATEGORY
      ? projectStoredApplication(currentOutput)
      : currentOutput),
    ...(currentOutput.category === YC_APPLICATION_CATEGORY
      ? { ownerId: currentUserId }
      : {}),
    category:
      currentOutput.category || document.getElementById("category").value,
    ...(currentOutput.category !== YC_APPLICATION_CATEGORY
      ? {
          intent: document.getElementById("intent").value,
          profileName: currentProfile?.name || "Unknown",
        }
      : {}),
    timestamp: Date.now(),
  };

  accepted.push(feedbackData);

  const recentAccepted = accepted.slice(-20);

  await chrome.storage.local.set({ accepted: recentAccepted });
}

function updateUIForCategory() {
  const category = document.getElementById("category").value;
  const emailMode =
    document.getElementById("emailMode")?.value || "initial_outreach";
  const uiState = getCategoryUiState(category, emailMode);
  const intentGroup = document.getElementById("intentGroup");
  const emailModeGroup = document.getElementById("emailModeGroup");
  const ycQuestionGroup = document.getElementById("ycQuestionGroup");
  const contextInputLabel = document.getElementById("contextInputLabel");
  const contextInput = document.getElementById("jdInput");
  const contextInputHelp = document.getElementById("contextInputHelp");
  const contextMaxCount = document.getElementById("contextMaxCount");
  const outputLabel = document.getElementById("messageOutputLabel");
  const fillButton = document.getElementById("fillBtn");

  document.getElementById("generateText").textContent = uiState.generateLabel;
  intentGroup?.classList.toggle("hidden", !uiState.showIntent);
  emailModeGroup?.classList.toggle("hidden", !uiState.showEmailMode);
  ycQuestionGroup?.classList.toggle("hidden", !uiState.showQuestion);
  fillButton?.classList.toggle("hidden", !uiState.showAutoFill);
  if (outputLabel) outputLabel.textContent = uiState.outputLabel;

  if (contextInputLabel && contextInput && contextMaxCount) {
    contextInputLabel.textContent = uiState.contextLabel;
    contextInput.placeholder = uiState.contextPlaceholder;
    contextInput.rows = category === YC_APPLICATION_CATEGORY ? 7 : 3;
    contextInput.maxLength = uiState.contextMaxLength;
    contextInput.required = uiState.contextRequired;
    contextInput.setAttribute(
      "aria-required",
      uiState.contextRequired ? "true" : "false",
    );
    contextMaxCount.textContent = String(uiState.contextMaxLength);
    if (contextInputHelp) {
      contextInputHelp.textContent = uiState.contextRequired
        ? "Required · paste at least 80 characters so the answer can be role-specific."
        : "";
      contextInputHelp.classList.toggle("hidden", !uiState.contextRequired);
    }
    updateCharacterCount();
  }

  updateQuestionCharacterCount();
  updateGenerateAvailability();
}

function setupCharacterCounter() {
  const jdInput = document.getElementById("jdInput");
  const charCount = document.getElementById("jdCharCount");

  // After showAuthRequired() replaces #mainContent children, the original
  // #jdInput is gone. If initializePopup() re-runs on a storage event
  // before the user reloads, these elements are null. Bail safely.
  if (!jdInput || !charCount) return;

  jdInput.addEventListener("input", () => {
    charCount.textContent = jdInput.value.length;
  });
}

function updateCharacterCount() {
  const jdInput = document.getElementById("jdInput");
  const charCount = document.getElementById("jdCharCount");
  if (!jdInput || !charCount) return;
  charCount.textContent = jdInput.value.length;
}

function updateQuestionCharacterCount() {
  const input = document.getElementById("ycQuestionInput");
  const count = document.getElementById("ycQuestionCharCount");
  if (!input || !count) return;
  count.textContent = `${parseApplicationQuestions(input.value).length}/5 questions · 500 characters each`;
}

function updateGenerateAvailability() {
  const button = document.getElementById("generateBtn");
  const category = document.getElementById("category")?.value;
  const generateText = document.getElementById("generateText");
  if (!button || !category) return;

  const emailMode =
    document.getElementById("emailMode")?.value || "initial_outreach";
  const uiState = getCategoryUiState(category, emailMode);
  const validation = validateGenerationInput({
    category,
    hasProfile: Boolean(currentProfile),
    contextValue: document.getElementById("jdInput")?.value || "",
    questionValue: document.getElementById("ycQuestionInput")?.value || "",
  });

  button.disabled = !validation.valid;
  const applicationMode = category === "yc_application";
  const inputStatus = document.getElementById("applicationInputStatus");
  if (inputStatus)
    inputStatus.textContent =
      applicationMode && !validation.valid ? validation.message : "";
  document
    .getElementById("ycQuestionInput")
    ?.setAttribute(
      "aria-invalid",
      String(
        applicationMode && Boolean(validation.code?.startsWith("YC_QUESTION")),
      ),
    );
  document
    .getElementById("jdInput")
    ?.setAttribute(
      "aria-invalid",
      String(
        applicationMode &&
          Boolean(validation.code?.startsWith("YC_JOB_DESCRIPTION")),
      ),
    );
  const regenerate = document.getElementById("regenerateApplicationBtn");
  if (regenerate) regenerate.disabled = !validation.valid;
  if (generateText) generateText.textContent = uiState.generateLabel;
}

async function updateUsageStats() {
  const { dailyUsage = {} } = await chrome.storage.local.get("dailyUsage");
  const today = new Date().toISOString().split("T")[0];
  const todayCount = dailyUsage[today] || 0;

  document.getElementById("usageCount").textContent = todayCount;
}

async function incrementUsageCount() {
  const { dailyUsage = {} } = await chrome.storage.local.get("dailyUsage");
  const today = new Date().toISOString().split("T")[0];

  dailyUsage[today] = (dailyUsage[today] || 0) + 1;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  Object.keys(dailyUsage).forEach((date) => {
    if (new Date(date) < thirtyDaysAgo) {
      delete dailyUsage[date];
    }
  });

  await chrome.storage.local.set({ dailyUsage });
  await updateUsageStats();
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

async function openDashboard() {
  const apiUrl = await getConfiguredApiUrl();
  await chrome.tabs.create({ url: `${apiUrl}/dashboard` });
}

function showError(message) {
  const errorEl = document.getElementById("errorMessage");
  const errorText = document.getElementById("errorText");

  if (!errorEl || !errorText) {
    // Elements don't exist (e.g. auth screen is showing) — try inline auth error
    const authErrorEl = document.getElementById("authError");
    const authErrorText = document.getElementById("authErrorText");
    if (authErrorEl && authErrorText) {
      authErrorText.textContent = message;
      authErrorEl.classList.remove("hidden");
      setTimeout(() => authErrorEl.classList.add("hidden"), 5000);
    } else {
      console.warn("showError: error elements not in DOM:", message);
    }
    return;
  }

  errorText.textContent = message;
  document.getElementById("errorDetails")?.classList.add("hidden");
  document.getElementById("errorAction")?.classList.add("hidden");
  errorEl.classList.remove("hidden");

  setTimeout(hideError, 5000);
}

function showGenerationError(presentation) {
  const errorEl = document.getElementById("errorMessage");
  const errorText = document.getElementById("errorText");
  const details = document.getElementById("errorDetails");
  const action = document.getElementById("errorAction");
  if (!errorEl || !errorText || !details || !action) {
    showError(presentation.message);
    return;
  }

  errorText.textContent = presentation.message;
  details.replaceChildren();
  const fields = [
    ...presentation.missingFields,
    ...presentation.recommendedFields,
  ];
  for (const field of fields.slice(0, 6)) {
    const item = document.createElement("li");
    item.textContent = field;
    details.appendChild(item);
  }
  details.classList.toggle("hidden", fields.length === 0);

  action.classList.add("hidden");
  if (
    presentation.actionLabel &&
    isTrustedAletheiaUrl(presentation.actionUrl)
  ) {
    action.textContent = presentation.actionLabel;
    action.href = presentation.actionUrl;
    action.classList.remove("hidden");
  }

  errorEl.classList.remove("hidden");
  errorEl.focus?.();
}

function isTrustedAletheiaUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      [
        "aletheia.live",
        "www.aletheia.live",
        "chrome.google.com",
        "chromewebstore.google.com",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function hideError() {
  document.getElementById("errorMessage")?.classList.add("hidden");
  document.getElementById("errorDetails")?.classList.add("hidden");
  document.getElementById("errorAction")?.classList.add("hidden");
  document.getElementById("authError")?.classList.add("hidden");
}

function showAuthError(message) {
  const errorEl =
    document.getElementById("errorMessage") ||
    document.getElementById("authError");
  const errorText =
    document.getElementById("errorText") ||
    document.getElementById("authErrorText");

  if (!errorEl || !errorText) {
    console.warn("showAuthError: error elements not in DOM:", message);
    return;
  }

  // Stable worker codes are useful to clients, but not useful UI copy.
  const displayMsg = message.replace(
    /^AUTH_(?:FAILED|REQUIRED|TIMEOUT):\s*/,
    "",
  );

  errorText.replaceChildren(document.createTextNode(displayMsg + " "));

  const reauthBtn = document.createElement("button");
  reauthBtn.className = "reauth-btn";
  reauthBtn.textContent = "Re-authenticate";
  reauthBtn.addEventListener("click", async () => {
    reauthBtn.textContent = "Connecting...";
    reauthBtn.disabled = true;
    try {
      // Clear stale auth first so handleAuthenticate() opens login tab
      await sendBackgroundMessage({ action: "logout" });
      const result = await sendBackgroundMessage({ action: "authenticate" });
      if (result?.success) {
        hideError();
        window.location.reload();
      } else {
        reauthBtn.textContent = "Re-authenticate";
        reauthBtn.disabled = false;
        showAuthError(
          result?.error || "Re-authentication failed. Please try again.",
        );
      }
    } catch (err) {
      reauthBtn.textContent = "Re-authenticate";
      reauthBtn.disabled = false;
      showAuthError("Re-authentication failed. Please try again.");
    }
  });

  errorText.appendChild(reauthBtn);
  errorEl.classList.remove("hidden");
  // Don't auto-hide auth errors — user needs to take action
}

function showTemporaryFeedback(element, text) {
  if (!element) return;
  const target = element.querySelector("#rejectLabel") || element;
  const originalText = target.textContent;
  target.textContent = text;

  setTimeout(() => {
    target.textContent = originalText;
  }, 2000);
}

function displayValidationFeedback(output) {
  const existingFeedback = document.querySelector(".validation-feedback");
  if (existingFeedback) existingFeedback.remove();

  const feedbackContainer = document.createElement("div");
  feedbackContainer.className = "validation-feedback";

  const validation = output.validation || {};
  const category = output.category;
  const feedbackItems = [];

  if (category === "linkedin_connection") {
    const charCount = output.character_count || 0;
    const isWithinLimit = charCount <= 300;

    feedbackItems.push({
      icon: isWithinLimit ? "✅" : "⚠️",
      text: `${charCount}/300 characters`,
      status: isWithinLimit ? "success" : "warning",
      details: isWithinLimit
        ? "Within LinkedIn limit"
        : "Exceeds LinkedIn character limit",
    });

    if (validation.truncated) {
      feedbackItems.push({
        icon: "✂️",
        text: "Message was truncated",
        status: "warning",
        details: `Original length: ${validation.original_length} characters`,
      });
    }
  }

  if (category === "cold_email" || category === "linkedin_inmail") {
    const wordCount = output.word_count || 0;
    const mode =
      output.evalMetadata?.emailMode ||
      document.getElementById("emailMode")?.value ||
      "initial_outreach";
    const limits = {
      initial_outreach: { min: 120, max: 185 },
      founder_ceo_outreach: { min: 105, max: 155 },
      follow_up: { min: 30, max: 90 },
      clarification: { min: 40, max: 90 },
      role_fit_summary: { min: 40, max: 110 },
      referral_request: { min: 70, max: 130 },
    };
    const selectedLimit = limits[mode] || limits.initial_outreach;
    const maxWords =
      category === "linkedin_inmail"
        ? Math.min(selectedLimit.max, 120)
        : selectedLimit.max;
    const minWords =
      category === "linkedin_inmail"
        ? Math.min(selectedLimit.min, 80)
        : selectedLimit.min;
    const isWithinRange = wordCount >= minWords && wordCount <= maxWords;

    feedbackItems.push({
      icon: isWithinRange ? "✅" : wordCount > maxWords ? "⚠️" : "ℹ️",
      text: `${wordCount}/${maxWords} words`,
      status: isWithinRange
        ? "success"
        : wordCount > maxWords
          ? "warning"
          : "info",
      details: `Recommended: ${minWords}-${maxWords} words`,
    });

    if (validation.fallback_parsing) {
      feedbackItems.push({
        icon: "⚠️",
        text: "Format validation skipped",
        status: "warning",
        details: "Response format could not be validated",
      });
    }
  }

  if (category === YC_APPLICATION_CATEGORY) {
    const counts = output.answers?.map((answer) => answer.word_count) ?? [
      output.word_count ||
        calculateCharCount(output.body || "", category).count,
    ];
    const isWithinRange = counts.every((count) => count >= 50 && count <= 150);
    feedbackItems.push({
      icon: isWithinRange ? "✅" : "⚠️",
      text: output.answers
        ? `${counts.length} answers within their word limits`
        : `${counts[0]} words`,
      status: isWithinRange ? "success" : "warning",
      details: "Required range: 50–150 words per answer",
    });
  }

  if (validation.sanitization_applied) {
    feedbackItems.push({
      icon: "🛡️",
      text: "AI-language removed",
      status: "info",
      details: "Corporate clichés and AI-sounding phrases were filtered out",
    });
  }

  if (validation.character_limit_passed || validation.word_limit_passed) {
    feedbackItems.push({
      icon: "🎯",
      text: "Platform optimized",
      status: "success",
      details: "Message follows platform best practices",
    });
  }

  if (feedbackItems.length > 0) {
    const header = document.createElement("div");
    header.className = "validation-header";

    const title = document.createElement("span");
    title.className = "validation-title";
    title.textContent = "📊 Message Analysis";
    header.appendChild(title);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "validation-toggle";
    toggleBtn.textContent = "Details";
    toggleBtn.onclick = toggleValidationDetails;
    header.appendChild(toggleBtn);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "validation-items";

    for (const item of feedbackItems) {
      const itemEl = document.createElement("div");
      itemEl.className = `validation-item ${item.status}`;

      const iconEl = document.createElement("span");
      iconEl.className = "validation-icon";
      iconEl.textContent = item.icon;
      itemEl.appendChild(iconEl);

      const textEl = document.createElement("span");
      textEl.className = "validation-text";
      textEl.textContent = item.text;
      itemEl.appendChild(textEl);

      const detailsEl = document.createElement("span");
      detailsEl.className = "validation-details hidden";
      detailsEl.textContent = item.details;
      itemEl.appendChild(detailsEl);

      itemsContainer.appendChild(itemEl);
    }

    feedbackContainer.appendChild(header);
    feedbackContainer.appendChild(itemsContainer);

    const messageBody = document.getElementById("messageBody");
    messageBody.insertAdjacentElement("afterend", feedbackContainer);
  }
}

function toggleValidationDetails() {
  const details = document.querySelectorAll(".validation-details");
  const toggleBtn = document.querySelector(".validation-toggle");

  const isHidden = details[0]?.classList.contains("hidden");

  details.forEach((detail) => {
    if (isHidden) {
      detail.classList.remove("hidden");
    } else {
      detail.classList.add("hidden");
    }
  });

  toggleBtn.textContent = isHidden ? "Hide" : "Details";
}

async function storeGeneration(output) {
  try {
    const category = document.getElementById("category").value;
    const isYcApplication = category === YC_APPLICATION_CATEGORY;
    const generationData = {
      output: isYcApplication ? projectStoredApplication(output) : output,
      ...(isYcApplication ? { ownerId: currentUserId } : {}),
      timestamp: Date.now(),
      profile: isYcApplication ? null : currentProfile,
      inputs: isYcApplication
        ? { category }
        : {
            contextValue: document.getElementById("jdInput").value.trim(),
            category,
            intent: document.getElementById("intent").value,
            emailMode:
              document.getElementById("emailMode")?.value || "initial_outreach",
          },
    };

    await chrome.storage.local.set({ lastGeneration: generationData });
  } catch (error) {
    console.error("Error storing generation:", error);
  }
}

async function restoreLastGeneration() {
  try {
    const { lastGeneration } = await chrome.storage.local.get("lastGeneration");

    if (!lastGeneration) return;
    if (
      lastGeneration.output?.category === YC_APPLICATION_CATEGORY &&
      (!currentUserId || lastGeneration.ownerId !== currentUserId)
    ) {
      await chrome.storage.local.remove("lastGeneration");
      return;
    }

    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    if (lastGeneration.timestamp < fourHoursAgo) {
      await chrome.storage.local.remove("lastGeneration");
      return;
    }

    if (lastGeneration.inputs) {
      document.getElementById("category").value =
        lastGeneration.inputs.category || "linkedin_connection";
      document.getElementById("intent").value =
        lastGeneration.inputs.intent || "networking";
      const emailMode = document.getElementById("emailMode");
      if (emailMode) {
        emailMode.value = lastGeneration.inputs.emailMode || "initial_outreach";
      }
      const restoredContext =
        lastGeneration.inputs.category === YC_APPLICATION_CATEGORY
          ? ""
          : (lastGeneration.inputs.contextValue ??
            (lastGeneration.inputs.emailMode === "follow_up"
              ? lastGeneration.inputs.conversationContext
              : lastGeneration.inputs.jd) ??
            "");
      document.getElementById("jdInput").value = restoredContext;

      updateCharacterCount();
      updateUIForCategory();
    }

    if (lastGeneration.output) {
      currentOutput = lastGeneration.output;
      displayOutput(
        lastGeneration.output.category === YC_APPLICATION_CATEGORY
          ? projectStoredApplication(lastGeneration.output)
          : lastGeneration.output,
      );
      if (lastGeneration.output.category === YC_APPLICATION_CATEGORY) {
        document.getElementById("ycQuestionInput").value = "";
        updateGenerateAvailability();
      }
    }

    showTemporaryMessage(
      lastGeneration.output?.category === YC_APPLICATION_CATEGORY
        ? "Answers restored. Re-enter questions and job description to generate again."
        : "Previous session restored",
      "info",
    );
  } catch (error) {
    console.error("Error restoring generation:", error);
  }
}

function showTemporaryMessage(message, type = "info") {
  const messageEl = document.createElement("div");
  messageEl.className = `temp-message ${type}`;
  messageEl.textContent = message;
  messageEl.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--accent-500);
    font-size: 12px;
    z-index: 1000;
    animation: slideInOut 3s ease-in-out forwards;
  `;

  document.body.appendChild(messageEl);

  setTimeout(() => {
    messageEl.remove();
  }, 3000);
}

async function handleProfileUpdated(profile) {
  if (!(await hasProfileExtractionConsent())) return;

  currentProfile = profile;
  if (profile) {
    showProfileDetected(profile);
    enableMainContent();
  } else {
    showNoProfile();
  }
}

// Handle messages from content scripts.
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "profileUpdated") {
    void handleProfileUpdated(message.profile);
  }
});

async function persistAuthenticationDraft() {
  const draft = buildApplicationAuthDraft({
    category: document.getElementById("category")?.value,
    jd: document.getElementById("jdInput")?.value,
    questions: document.getElementById("ycQuestionInput")?.value,
    ownerId: currentUserId,
  });
  await saveApplicationAuthDraft(draft, chrome.storage.session, chrome.alarms);
}

async function restoreAuthenticationDraft() {
  const stored = await chrome.storage.session.get(APPLICATION_AUTH_DRAFT_KEY);
  const draft = readApplicationAuthDraft(
    stored[APPLICATION_AUTH_DRAFT_KEY],
    currentUserId,
  );
  await chrome.storage.session.remove(APPLICATION_AUTH_DRAFT_KEY);
  await chrome.alarms.clear("application-auth-draft-expiry");
  if (!draft) return;
  document.getElementById("category").value = draft.category;
  document.getElementById("jdInput").value = draft.jd;
  document.getElementById("ycQuestionInput").value = draft.questions;
  updateUIForCategory();
  updateCharacterCount();
  updateQuestionCharacterCount();
  document.getElementById("ycQuestionInput").focus();
  showTemporaryMessage(
    "Your application draft was restored after sign-in.",
    "info",
  );
}
