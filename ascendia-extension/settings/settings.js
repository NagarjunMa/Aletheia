// Aletheia Extension Settings JavaScript
// Manages extension configuration, account connection, and preferences

// Initialize when DOM loads
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("extensionVersion").textContent =
    `v${chrome.runtime.getManifest().version}`;
  await initializeSettings();
  setupEventListeners();
  await loadUserSettings();
  await checkConnectionStatus();
});

// Production default - used when no custom URL has been saved
const DEFAULT_API_URL = "https://www.aletheia.live";
const BACKGROUND_UNAVAILABLE_CODE = "BACKGROUND_UNAVAILABLE";

function sendBackgroundMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError || response === undefined) {
          const detail =
            runtimeError?.message ||
            "The background worker returned no response.";
          console.error(`[SETTINGS] ${message.action} failed:`, detail);
          resolve({
            success: false,
            authenticated: false,
            code: BACKGROUND_UNAVAILABLE_CODE,
            error:
              "The extension background service is unavailable. Reload the extension and try again.",
          });
          return;
        }
        resolve(response);
      });
    } catch (error) {
      console.error(`[SETTINGS] ${message.action} could not be sent:`, error);
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

function normalizeApiUrl(apiUrl) {
  let value = String(apiUrl || "").trim();
  while (value.endsWith("/") && !value.endsWith("://")) {
    value = value.slice(0, -1);
  }
  return value;
}

// Global state
let currentSettings = {
  apiUrl: DEFAULT_API_URL,
  autoFillEnabled: true,
  showNotifications: true,
  maxDailyUsage: 50,
};

async function initializeSettings() {
  // Read the API base URL from chrome.storage.sync (shared across devices)
  const { apiBaseUrl } = await chrome.storage.sync.get("apiBaseUrl");

  const stored = await chrome.storage.local.get(["apiUrl", "settings"]);

  currentSettings = {
    ...currentSettings,
    ...stored,
    ...stored.settings,
    // Prefer sync storage, then local, then default
    apiUrl: normalizeApiUrl(apiBaseUrl || stored.apiUrl || DEFAULT_API_URL),
  };

  updateStatusIndicators();
}

function setupEventListeners() {
  // API URL - select dropdown + custom text input + hidden legacy input
  document
    .getElementById("apiUrlSelect")
    .addEventListener("change", handleApiUrlSelectChange);
  document
    .getElementById("apiUrlCustom")
    .addEventListener("input", handleApiUrlCustomChange);
  document
    .getElementById("apiUrlInput")
    .addEventListener("input", handleApiUrlChange);
  document
    .getElementById("testConnectionBtn")
    .addEventListener("click", testConnection);

  // Auth actions
  document
    .getElementById("connectBtn")
    ?.addEventListener("click", handleConnect);
  document
    .getElementById("disconnectBtn")
    ?.addEventListener("click", handleDisconnect);
  document
    .getElementById("openDashboardBtn")
    ?.addEventListener("click", openDashboard);

  document
    .getElementById("manageResumesBtn")
    ?.addEventListener("click", openResumeDashboard);

  // Usage Preferences
  document
    .getElementById("autoFillEnabled")
    .addEventListener("change", handleAutoFillToggle);
  document
    .getElementById("showNotifications")
    .addEventListener("change", handleNotificationsToggle);
  document
    .getElementById("maxDailyUsage")
    .addEventListener("input", handleDailyUsageChange);

  // Data Management
  document
    .getElementById("clearDataBtn")
    .addEventListener("click", clearAllData);
  document
    .getElementById("exportDataBtn")
    .addEventListener("click", exportUsageData);

  // Save Actions
  document
    .getElementById("saveSettingsBtn")
    .addEventListener("click", saveAllSettings);
  document
    .getElementById("resetSettingsBtn")
    .addEventListener("click", resetToDefaults);

  // Status Message
  document
    .getElementById("closeStatus")
    .addEventListener("click", hideStatusMessage);
}

async function loadUserSettings() {
  // Populate the API URL select / custom input
  const apiSelect = document.getElementById("apiUrlSelect");
  const apiCustomInput = document.getElementById("apiUrlCustom");
  const currentUrl = currentSettings.apiUrl || DEFAULT_API_URL;

  // Check if the current URL matches one of the preset options
  const presetValues = Array.from(apiSelect.options).map((o) => o.value);
  if (presetValues.includes(currentUrl)) {
    apiSelect.value = currentUrl;
    apiCustomInput.classList.add("hidden");
  } else {
    apiSelect.value = "custom";
    apiCustomInput.value = currentUrl;
    apiCustomInput.classList.remove("hidden");
  }

  document.getElementById("apiUrlInput").value = currentUrl;
  // Checkboxes
  document.getElementById("autoFillEnabled").checked =
    currentSettings.autoFillEnabled !== false;
  document.getElementById("showNotifications").checked =
    currentSettings.showNotifications !== false;

  // Range slider
  const dailyUsageSlider = document.getElementById("maxDailyUsage");
  const dailyUsageValue = document.getElementById("dailyUsageValue");
  dailyUsageSlider.value = currentSettings.maxDailyUsage || 50;
  dailyUsageValue.textContent = dailyUsageSlider.value;

  await removeLegacyResumeIfServerReady();
}

async function updateStatusIndicators() {
  // Auth Status
  const authStatus = await sendBackgroundMessage({ action: "getAuthStatus" });

  const authStatusCard = document.getElementById("authStatus");
  const authStatusText = document.getElementById("authStatusText");
  const connectBtn = document.getElementById("connectBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");

  if (authStatus && authStatus.authenticated) {
    authStatusCard.classList.add("success");
    authStatusCard.classList.remove("error");
    authStatusText.textContent = authStatus.user?.email || "Connected";
    authStatusText.classList.add("success");
    authStatusText.classList.remove("error");
    if (connectBtn) connectBtn.classList.add("hidden");
    if (disconnectBtn) disconnectBtn.classList.remove("hidden");
  } else {
    authStatusCard.classList.add("error");
    authStatusCard.classList.remove("success");
    authStatusText.textContent = "Not connected";
    authStatusText.classList.add("error");
    authStatusText.classList.remove("success");
    if (connectBtn) connectBtn.classList.remove("hidden");
    if (disconnectBtn) disconnectBtn.classList.add("hidden");
  }

  // Resume Status
  const resumeStatus = document.getElementById("resumeStatus");
  const resumeStatusText = document.getElementById("resumeStatusText");

  resumeStatus.classList.add("warning");
  resumeStatus.classList.remove("success", "error");
  resumeStatusText.textContent = "Checking server";
  resumeStatusText.classList.add("warning");
  resumeStatusText.classList.remove("success", "error");
}

async function checkConnectionStatus() {
  const connectionStatus = document.getElementById("connectionStatus");
  const connectionStatusText = document.getElementById("connectionStatusText");

  // Check auth first
  const authStatus = await sendBackgroundMessage({ action: "getAuthStatus" });

  if (!authStatus || !authStatus.authenticated) {
    connectionStatus.classList.add("error");
    connectionStatusText.textContent = "Not connected";
    connectionStatusText.classList.add("error");
    const resumeStatus = document.getElementById("resumeStatus");
    const resumeStatusText = document.getElementById("resumeStatusText");
    resumeStatus.classList.add("warning");
    resumeStatus.classList.remove("success", "error");
    resumeStatusText.textContent = "Connect first";
    resumeStatusText.classList.add("warning");
    resumeStatusText.classList.remove("success", "error");
    return;
  }

  try {
    connectionStatusText.textContent = "Testing...";

    const result = await sendBackgroundMessage({ action: "healthCheck" });

    if (result && result.success) {
      connectionStatus.classList.add("success");
      connectionStatus.classList.remove("error", "warning");
      connectionStatusText.textContent = "Connected";
      connectionStatusText.classList.add("success");
      connectionStatusText.classList.remove("error", "warning");
      await updateResumeStatus(result.data?.resume);
    } else {
      throw new Error(result?.error || "Connection failed");
    }
  } catch (error) {
    console.error("Connection test error:", error);

    connectionStatus.classList.add("error");
    connectionStatus.classList.remove("success", "warning");
    connectionStatusText.classList.add("error");
    connectionStatusText.classList.remove("success", "warning");
    connectionStatusText.textContent = error.message || "Connection failed";
    await updateResumeStatus(null);
  }
}

async function updateResumeStatus(resume) {
  const resumeStatus = document.getElementById("resumeStatus");
  const resumeStatusText = document.getElementById("resumeStatusText");

  if (resume?.has_primary) {
    resumeStatus.classList.add("success");
    resumeStatus.classList.remove("warning", "error");
    resumeStatusText.textContent = `${resume.parsed_text_chars || 0} chars ready`;
    resumeStatusText.classList.add("success");
    resumeStatusText.classList.remove("warning", "error");
    await chrome.storage.local.remove(["resume", "resumeFile"]);
    return;
  }

  resumeStatus.classList.add("warning");
  resumeStatus.classList.remove("success", "error");
  resumeStatusText.textContent = "Dashboard setup required";
  resumeStatusText.classList.add("warning");
  resumeStatusText.classList.remove("success", "error");
}

async function removeLegacyResumeIfServerReady() {
  try {
    const result = await sendBackgroundMessage({ action: "healthCheck" });
    if (result?.success) {
      await updateResumeStatus(result.data?.resume);
    }
  } catch (error) {
    console.warn("Resume status check failed:", error);
  }
}

async function openResumeDashboard() {
  const apiUrl = normalizeApiUrl(currentSettings.apiUrl || DEFAULT_API_URL);
  await chrome.tabs.create({ url: `${apiUrl}/profile` });
}

async function openDashboard() {
  const apiUrl = normalizeApiUrl(currentSettings.apiUrl || DEFAULT_API_URL);
  await chrome.tabs.create({ url: `${apiUrl}/dashboard` });
}

async function handleConnect() {
  const btn = document.getElementById("connectBtn");
  const originalText = btn.textContent;
  btn.textContent = "Connecting...";
  btn.disabled = true;
  console.log("[SETTINGS] Connect clicked, sending authenticate message...");

  try {
    const result = await sendBackgroundMessage({ action: "authenticate" });
    console.log("[SETTINGS] authenticate response:", JSON.stringify(result));

    if (result && result.success) {
      console.log("[SETTINGS] Connected:", result.user?.email);
      showStatusMessage("Connected to Aletheia!", "success");
      await updateStatusIndicators();
      await checkConnectionStatus();
    } else {
      console.error("[SETTINGS] Failed:", result?.error);
      showStatusMessage(
        result?.error ||
          "Connection failed. Make sure you are logged in to the Aletheia web app.",
        "error",
      );
    }
  } catch (error) {
    console.error("[SETTINGS] authenticate threw:", error);
    showStatusMessage("Connection failed: " + error.message, "error");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleDisconnect() {
  const confirmed = confirm(
    "Disconnect from Aletheia? You will need to reconnect to use the extension.",
  );
  if (!confirmed) return;

  try {
    const result = await sendBackgroundMessage({ action: "logout" });

    if (result && result.success) {
      showStatusMessage("Disconnected from Aletheia", "success");
      await updateStatusIndicators();
      await checkConnectionStatus();
    }
  } catch (error) {
    showStatusMessage("Disconnect failed: " + error.message, "error");
  }
}

// Event Handlers
function handleApiUrlSelectChange(e) {
  const value = e.target.value;
  const customInput = document.getElementById("apiUrlCustom");

  if (value === "custom") {
    customInput.classList.remove("hidden");
    customInput.focus();
    currentSettings.apiUrl = normalizeApiUrl(
      customInput.value || DEFAULT_API_URL,
    );
  } else {
    customInput.classList.add("hidden");
    currentSettings.apiUrl = normalizeApiUrl(value);
  }

  // Keep the hidden legacy input in sync
  document.getElementById("apiUrlInput").value = currentSettings.apiUrl;
}

function handleApiUrlCustomChange(e) {
  currentSettings.apiUrl = normalizeApiUrl(e.target.value);
  document.getElementById("apiUrlInput").value = currentSettings.apiUrl;
}

function handleApiUrlChange(e) {
  currentSettings.apiUrl = normalizeApiUrl(e.target.value);
}

async function testConnection() {
  const button = document.getElementById("testConnectionBtn");
  const originalText = button.textContent;

  button.textContent = "Testing...";
  button.disabled = true;

  try {
    await checkConnectionStatus();
    showStatusMessage("Connection test completed!", "success");
  } catch (error) {
    showStatusMessage("Connection test failed: " + error.message, "error");
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

function handleAutoFillToggle(e) {
  currentSettings.autoFillEnabled = e.target.checked;
}

function handleNotificationsToggle(e) {
  currentSettings.showNotifications = e.target.checked;
}

function handleDailyUsageChange(e) {
  currentSettings.maxDailyUsage = parseInt(e.target.value);
  document.getElementById("dailyUsageValue").textContent = e.target.value;
}

async function clearAllData() {
  const confirmed = confirm(
    "This will permanently delete all your settings, resume, and usage history. This action cannot be undone.\n\nAre you sure?",
  );

  if (!confirmed) return;

  try {
    showLoadingOverlay("Clearing all data...");

    await chrome.storage.local.clear();
    await chrome.storage.sync.remove("apiBaseUrl");

    currentSettings = {
      apiUrl: DEFAULT_API_URL,
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50,
    };

    window.location.reload();
  } catch (error) {
    showStatusMessage("Failed to clear data: " + error.message, "error");
  } finally {
    hideLoadingOverlay();
  }
}

async function exportUsageData() {
  try {
    showLoadingOverlay("Exporting usage data...");

    const data = await chrome.storage.local.get([
      "dailyUsage",
      "categoryUsage",
      "accepted",
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      dailyUsage: data.dailyUsage || {},
      categoryUsage: data.categoryUsage || {},
      acceptedMessages: data.accepted || [],
      settings: {
        maxDailyUsage: currentSettings.maxDailyUsage,
        autoFillEnabled: currentSettings.autoFillEnabled,
        showNotifications: currentSettings.showNotifications,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aletheia-usage-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatusMessage("Usage data exported successfully!", "success");
  } catch (error) {
    showStatusMessage("Failed to export data: " + error.message, "error");
  } finally {
    hideLoadingOverlay();
  }
}

async function saveAllSettings() {
  try {
    showLoadingOverlay("Saving settings...");

    if (!currentSettings.apiUrl) {
      throw new Error("API URL is required");
    }

    // Persist the API base URL in sync storage (shared across devices)
    const apiUrl = normalizeApiUrl(currentSettings.apiUrl);
    currentSettings.apiUrl = apiUrl;
    await chrome.storage.sync.set({ apiBaseUrl: apiUrl });

    await chrome.storage.local.set({
      apiUrl,
      settings: {
        autoFillEnabled: currentSettings.autoFillEnabled,
        showNotifications: currentSettings.showNotifications,
        maxDailyUsage: currentSettings.maxDailyUsage,
      },
    });

    await checkConnectionStatus();

    showStatusMessage("Settings saved successfully!", "success");
  } catch (error) {
    showStatusMessage("Failed to save settings: " + error.message, "error");
  } finally {
    hideLoadingOverlay();
  }
}

async function resetToDefaults() {
  const confirmed = confirm("Reset all settings to default values?");
  if (!confirmed) return;

  try {
    document.getElementById("apiUrlInput").value = DEFAULT_API_URL;
    document.getElementById("apiUrlSelect").value = DEFAULT_API_URL;
    document.getElementById("apiUrlCustom").classList.add("hidden");
    document.getElementById("autoFillEnabled").checked = true;
    document.getElementById("showNotifications").checked = true;
    document.getElementById("maxDailyUsage").value = 50;
    document.getElementById("dailyUsageValue").textContent = "50";

    currentSettings = {
      apiUrl: DEFAULT_API_URL,
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50,
    };

    showStatusMessage("Settings reset to defaults", "success");
  } catch (error) {
    showStatusMessage("Failed to reset settings: " + error.message, "error");
  }
}

// UI Helper Functions
function showStatusMessage(message, type = "success") {
  const statusEl = document.getElementById("statusMessage");
  const textEl = document.getElementById("statusText");

  textEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.classList.remove("hidden");

  setTimeout(() => {
    hideStatusMessage();
  }, 5000);
}

function hideStatusMessage() {
  document.getElementById("statusMessage").classList.add("hidden");
}

function showLoadingOverlay(message = "Loading...") {
  const overlay = document.getElementById("loadingOverlay");
  const text = document.getElementById("loadingText");

  text.textContent = message;
  overlay.classList.remove("hidden");
}

function hideLoadingOverlay() {
  document.getElementById("loadingOverlay").classList.add("hidden");
}

// Auto-save functionality
let saveTimeout;
function autoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const apiUrl = normalizeApiUrl(currentSettings.apiUrl);
      currentSettings.apiUrl = apiUrl;
      await chrome.storage.sync.set({ apiBaseUrl: apiUrl });
      await chrome.storage.local.set({
        apiUrl,
        settings: {
          autoFillEnabled: currentSettings.autoFillEnabled,
          showNotifications: currentSettings.showNotifications,
          maxDailyUsage: currentSettings.maxDailyUsage,
        },
      });
    } catch (error) {
      console.warn("Auto-save failed:", error);
    }
  }, 2000);
}

document.addEventListener("input", autoSave);
document.addEventListener("change", autoSave);

console.log("Aletheia Settings page loaded");
