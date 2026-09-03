// LinkedIn Profile Reader Content Script
// Extracts LinkedIn profile text via innerText — no CSS selectors, no external libraries.
// This approach is immune to LinkedIn DOM/class changes.

(function () {
  "use strict";

  if (window.__aletheiaLinkedInReaderInitialized) {
    return;
  }
  window.__aletheiaLinkedInReaderInitialized = true;

  let lastExtractedProfile = null;
  let extractionTimeout = null;
  let profileObserver = null;
  let navigationInterval = null;
  let cleanedUp = false;
  let profileExtractionConsent = false;
  let profileReaderActive = false;
  const PROFILE_EXTRACTION_CONSENT_KEY = "profileExtractionConsent";

  function reportDiagnostic(event, fields = {}) {
    try {
      if (!isExtensionContextValid()) return;
      void chrome.runtime.sendMessage({ action: "diagnostic", event, fields });
    } catch {
      // Diagnostics must never interfere with user-selected profile reading.
    }
  }

  // Initialize when page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProfileReader);
  } else {
    initializeProfileReader();
  }

  async function initializeProfileReader() {
    if (!isExtensionContextValid()) {
      cleanup("initialize: context invalid");
      return;
    }

    registerMessageListener();
    registerConsentListener();
    const stored = await chrome.storage.local.get(
      PROFILE_EXTRACTION_CONSENT_KEY,
    );
    profileExtractionConsent = stored[PROFILE_EXTRACTION_CONSENT_KEY] === true;

    if (profileExtractionConsent) {
      activateProfileReader();
    } else {
      reportDiagnostic("profile_reader.consent_pending");
    }
  }

  function activateProfileReader() {
    if (!profileExtractionConsent || profileReaderActive || cleanedUp) return;
    if (!isLinkedInProfilePage()) {
      return;
    }

    profileReaderActive = true;
    setTimeout(() => {
      extractAndNotifyProfile();
    }, 1500);
    extractAndNotifyProfile();

    observeProfileChanges();
    startNavigationWatcher();
    reportDiagnostic("profile_reader.initialized", { outcome: "success" });
  }

  function isLinkedInProfilePage() {
    return (
      window.location.pathname.startsWith("/in/") &&
      window.location.hostname.includes("linkedin.com")
    );
  }

  function extractLinkedInProfile() {
    if (!profileExtractionConsent || !profileReaderActive) return null;
    try {
      // Extract name from page title — far more stable than CSS selectors.
      // LinkedIn title format: "John Smith - Software Engineer | LinkedIn"
      const rawTitle = document.title || "";
      const name =
        rawTitle.split(" - ")[0].replace(" | LinkedIn", "").trim() || null;

      if (!name) {
        reportDiagnostic("profile_reader.extraction_failed", {
          outcome: "failure",
          errorCode: "PROFILE_NAME_UNAVAILABLE",
        });
        return null;
      }

      // Extract plain text from the main profile content area.
      // innerText requires no external library, is selector-independent,
      // and produces clean readable text Claude can parse directly.
      const mainEl = document.querySelector("main") || document.body;
      const profileMarkdown = (mainEl.innerText || "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 8000);

      if (profileMarkdown.length < 50) {
        reportDiagnostic("profile_reader.extraction_failed", {
          outcome: "failure",
          errorCode: "PROFILE_CONTENT_UNAVAILABLE",
        });
        return null;
      }

      return {
        name,
        profileMarkdown,
        extractedAt: Date.now(),
      };
    } catch {
      reportDiagnostic("profile_reader.extraction_failed", {
        outcome: "failure",
        errorCode: "PROFILE_EXTRACTION_FAILED",
      });
      return null;
    }
  }

  function extractAndNotifyProfile() {
    if (cleanedUp || !profileExtractionConsent || !profileReaderActive) return;

    if (extractionTimeout) {
      clearTimeout(extractionTimeout);
    }

    extractionTimeout = setTimeout(() => {
      if (cleanedUp || !profileExtractionConsent || !profileReaderActive)
        return;

      const profile = extractLinkedInProfile();

      if (
        profile &&
        (!lastExtractedProfile ||
          hasProfileChanged(profile, lastExtractedProfile))
      ) {
        lastExtractedProfile = profile;
        reportDiagnostic("profile_reader.extraction_complete", {
          outcome: "success",
          contentLength: profile.profileMarkdown.length,
        });

        sendRuntimeMessage({
          action: "profileUpdated",
          profile,
        });
      }
    }, 500);
  }

  function hasProfileChanged(newProfile, oldProfile) {
    if (!oldProfile) return true;
    return (
      newProfile.name !== oldProfile.name ||
      newProfile.profileMarkdown.length !== oldProfile.profileMarkdown.length
    );
  }

  function observeProfileChanges() {
    profileObserver = new MutationObserver((mutations) => {
      let shouldReextract = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                node.matches?.("main, section") ||
                node.querySelector?.("main, section")
              ) {
                shouldReextract = true;
                break;
              }
            }
          }
        }
        if (shouldReextract) break;
      }

      if (shouldReextract) {
        extractAndNotifyProfile();
      }
    });

    profileObserver.observe(document.body, { childList: true, subtree: true });
  }

  function isExtensionContextValid() {
    try {
      return (
        typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id
      );
    } catch (error) {
      return false;
    }
  }

  function cleanup(reason) {
    if (cleanedUp) return;
    cleanedUp = true;
    if (reason)
      reportDiagnostic("profile_reader.cleanup", { outcome: "success" });

    stopProfileExtraction();

    try {
      if (isExtensionContextValid()) {
        chrome.runtime.onMessage.removeListener(handleMessage);
        chrome.storage.onChanged.removeListener(handleConsentChange);
      }
    } catch (error) {
      // The extension context is already invalid; nothing else to clean up.
    }

    window.__aletheiaLinkedInReaderInitialized = false;
  }

  function sendRuntimeMessage(message) {
    if (!isExtensionContextValid()) {
      cleanup("extension context invalid");
      return false;
    }

    try {
      const sendPromise = chrome.runtime.sendMessage(message);
      if (sendPromise && typeof sendPromise.catch === "function") {
        sendPromise.catch((error) => {
          if (/context invalidated/i.test(error?.message || "")) {
            cleanup("async sendMessage: context invalidated");
          } else {
            reportDiagnostic("profile_reader.message_failed", {
              outcome: "failure",
              errorCode: "RUNTIME_MESSAGE_FAILED",
            });
          }
        });
      }
      return true;
    } catch (error) {
      if (/context invalidated/i.test(error?.message || "")) {
        cleanup("sendMessage threw: context invalidated");
      } else {
        reportDiagnostic("profile_reader.message_failed", {
          outcome: "failure",
          errorCode: "RUNTIME_MESSAGE_FAILED",
        });
      }
      return false;
    }
  }

  function registerMessageListener() {
    if (!isExtensionContextValid()) {
      cleanup("register listener: context invalid");
      return;
    }

    try {
      chrome.runtime.onMessage.addListener(handleMessage);
    } catch (error) {
      if (/context invalidated/i.test(error?.message || "")) {
        cleanup("addListener threw: context invalidated");
      } else {
        reportDiagnostic("profile_reader.message_failed", {
          outcome: "failure",
          errorCode: "RUNTIME_LISTENER_FAILED",
        });
      }
    }
  }

  function registerConsentListener() {
    try {
      chrome.storage.onChanged.addListener(handleConsentChange);
    } catch (error) {
      if (/context invalidated/i.test(error?.message || "")) {
        cleanup("add storage listener: context invalidated");
      }
    }
  }

  function handleConsentChange(changes, areaName) {
    if (areaName !== "local" || !changes[PROFILE_EXTRACTION_CONSENT_KEY])
      return;

    profileExtractionConsent =
      changes[PROFILE_EXTRACTION_CONSENT_KEY].newValue === true;
    if (profileExtractionConsent) {
      activateProfileReader();
    } else {
      stopProfileExtraction();
    }
  }

  function stopProfileExtraction() {
    if (extractionTimeout) {
      clearTimeout(extractionTimeout);
      extractionTimeout = null;
    }
    if (navigationInterval) {
      clearInterval(navigationInterval);
      navigationInterval = null;
    }
    if (profileObserver) {
      profileObserver.disconnect();
      profileObserver = null;
    }
    profileReaderActive = false;
    lastExtractedProfile = null;
  }

  function handleMessage(message, sender, sendResponse) {
    try {
      if (!profileExtractionConsent || !profileReaderActive) {
        sendResponse({
          success: false,
          error: "Profile access requires consent.",
        });
        return true;
      }
      switch (message.action) {
        case "getProfile": {
          const profile = extractLinkedInProfile();
          sendResponse({ success: true, profile });
          break;
        }
        case "reextractProfile":
          extractAndNotifyProfile();
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      reportDiagnostic("profile_reader.message_failed", {
        outcome: "failure",
        errorCode: "PROFILE_MESSAGE_HANDLING_FAILED",
      });
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  function startNavigationWatcher() {
    // SPA navigation watcher. Only started after we know this script is on a
    // profile page; manual injection on /feed/ should stay inert.
    let lastUrl = window.location.href;

    navigationInterval = setInterval(() => {
      if (!profileExtractionConsent || !profileReaderActive) return;
      if (!isExtensionContextValid()) {
        cleanup("navigation watcher: context invalid");
        return;
      }

      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;

        if (isLinkedInProfilePage()) {
          setTimeout(extractAndNotifyProfile, 1500);
        } else {
          lastExtractedProfile = null;
          sendRuntimeMessage({ action: "profileUpdated", profile: null });
        }
      }
    }, 1000);
  }

  window.addEventListener("pagehide", () => cleanup("pagehide"));
  window.addEventListener("beforeunload", () => cleanup("beforeunload"));
})();
