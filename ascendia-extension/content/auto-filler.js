// Apollo and LinkedIn Auto-fill Content Script
// Automatically fills generated messages into various platforms

(function () {
  "use strict";

  function reportDiagnostic(event, fields = {}) {
    try {
      if (!chrome?.runtime?.id) return;
      void chrome.runtime.sendMessage({ action: "diagnostic", event, fields });
    } catch {
      // Diagnostics are optional and must not interfere with filling fields.
    }
  }

  // Auto-fill configuration for different platforms
  const PLATFORM_CONFIGS = {
    apollo: {
      hostname: "apollo.io",
      selectors: {
        composeEmail: {
          subject: 'input[placeholder*="Subject"], input[name*="subject"]',
          body: 'textarea[placeholder*="message"], textarea[name*="message"], div[contenteditable="true"]',
        },
        sequence: {
          subject:
            'input[data-testid*="subject"], input[placeholder*="subject line"]',
          body: 'textarea[data-testid*="body"], div[data-testid*="editor"]',
        },
      },
    },
    linkedin: {
      hostname: "linkedin.com",
      selectors: {
        connection: {
          message:
            'textarea[name="message"], textarea[placeholder*="Add a note"]',
        },
        inmail: {
          subject: 'input[name="subject"]',
          body: 'textarea[name="message"], div[data-placeholder*="Write a message"]',
        },
        messaging: {
          body: 'div[contenteditable="true"], textarea[placeholder*="Write a message"]',
        },
      },
    },
  };

  // Initialize auto-filler when page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAutoFiller);
  } else {
    initializeAutoFiller();
  }

  function initializeAutoFiller() {
    // Listen for auto-fill requests from popup
    chrome.runtime.onMessage.addListener(handleAutoFillRequest);

    // Set up visual feedback system
    addStylesForFeedback();

    reportDiagnostic("auto_filler.initialized", {
      platform: window.location.hostname.includes("apollo.io")
        ? "apollo"
        : "linkedin",
    });
  }

  function handleAutoFillRequest(message, sender, sendResponse) {
    if (message.action !== "autoFill") {
      return false;
    }

    try {
      const result = performAutoFill(message.data);
      reportDiagnostic("auto_filler.complete", {
        outcome: "success",
        platform: window.location.hostname.includes("apollo.io")
          ? "apollo"
          : "linkedin",
      });
      sendResponse({ success: true, result });
    } catch (error) {
      reportDiagnostic("auto_filler.complete", {
        outcome: "failure",
        errorCode: "AUTO_FILL_FAILED",
      });
      sendResponse({
        success: false,
        error: error.message || "Auto-fill failed",
      });
    }

    return true; // Keep message channel open for async response
  }

  function performAutoFill(data) {
    const hostname = window.location.hostname;
    let platform = null;

    // Determine platform
    for (const [platformKey, config] of Object.entries(PLATFORM_CONFIGS)) {
      if (hostname.includes(config.hostname)) {
        platform = { key: platformKey, config };
        break;
      }
    }

    if (!platform) {
      throw new Error(`Auto-fill not supported on ${hostname}`);
    }

    // Detect current context (compose, sequence, messaging, etc.)
    const context = detectContext(platform.config);
    if (!context) {
      throw new Error("Could not detect message composition area");
    }

    // Perform the actual filling
    const result = fillFields(context, data);

    // Show visual confirmation
    showFillConfirmation(result);

    return result;
  }

  function detectContext(platformConfig) {
    // Try to detect which type of message composition is active
    for (const [contextName, selectors] of Object.entries(
      platformConfig.selectors,
    )) {
      const hasRequiredElements = Object.values(selectors).some((selector) => {
        return document.querySelector(selector) !== null;
      });

      if (hasRequiredElements) {
        return { name: contextName, selectors };
      }
    }

    return null;
  }

  function fillFields(context, data) {
    const results = {
      filled: [],
      failed: [],
      context: context.name,
    };

    // Fill subject line if available
    if (context.selectors.subject && data.subject_line) {
      const subjectResult = fillField(
        context.selectors.subject,
        data.subject_line,
        "Subject",
      );
      if (subjectResult.success) {
        results.filled.push(subjectResult);
      } else {
        results.failed.push(subjectResult);
      }
    }

    // Fill message body
    const bodySelector = context.selectors.body || context.selectors.message;
    const bodyContent = data.body || data.message;

    if (bodySelector && bodyContent) {
      const bodyResult = fillField(bodySelector, bodyContent, "Message Body");
      if (bodyResult.success) {
        results.filled.push(bodyResult);
      } else {
        results.failed.push(bodyResult);
      }
    }

    return results;
  }

  function fillField(selector, content, fieldName) {
    try {
      const element = document.querySelector(selector);

      if (!element) {
        return {
          success: false,
          field: fieldName,
          error: "Element not found",
          selector,
        };
      }

      // Handle different input types
      if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        // Regular input/textarea
        element.focus();
        element.value = content;

        // Trigger events to notify the application
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (element.contentEditable === "true") {
        // Content-editable div (common in modern web apps)
        element.focus();

        // Clear existing content
        element.replaceChildren();

        // Insert new content
        if (element.getAttribute("data-placeholder")) {
          // Some platforms use placeholder attributes
          element.setAttribute("data-placeholder", "");
        }

        // Insert text content
        const textNode = document.createTextNode(content);
        element.appendChild(textNode);

        // Trigger input events
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
      } else {
        return {
          success: false,
          field: fieldName,
          error: "Unsupported element type",
          elementType: element.tagName,
        };
      }

      // Visual feedback
      highlightFilledElement(element);

      return {
        success: true,
        field: fieldName,
        selector,
        contentLength: content.length,
      };
    } catch (error) {
      return {
        success: false,
        field: fieldName,
        error: error.message,
        selector,
      };
    }
  }

  function highlightFilledElement(element) {
    // Add temporary highlight to show what was filled
    const originalStyle = {
      outline: element.style.outline,
      boxShadow: element.style.boxShadow,
    };

    // Apply highlight
    element.style.outline = "2px solid #78b49b";
    element.style.boxShadow = "0 0 8px rgba(90, 157, 130, 0.42)";

    // Remove highlight after 2 seconds
    setTimeout(() => {
      element.style.outline = originalStyle.outline;
      element.style.boxShadow = originalStyle.boxShadow;
    }, 2000);
  }

  function showFillConfirmation(result) {
    // Create temporary notification
    const notification = document.createElement("div");
    notification.className = "aletheia-fill-notification";

    const content = document.createElement("div");
    content.className = "aletheia-notification-content";

    const icon = document.createElement("div");
    icon.className = "aletheia-icon";
    icon.textContent = "✓";

    const text = document.createElement("div");
    text.className = "aletheia-text";

    const title = document.createElement("strong");
    title.textContent = "Message Filled!";

    const count = document.createElement("small");
    count.textContent = `${result.filled.length} field(s) completed`;

    text.append(title, document.createElement("br"), count);
    content.append(icon, text);
    notification.appendChild(content);

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);

    // Remove on click
    notification.addEventListener("click", () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  function addStylesForFeedback() {
    // Add CSS for visual feedback elements
    const style = document.createElement("style");
    style.textContent = `
      .aletheia-fill-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1e4938, #285d49);
        color: #f7faf9;
        border: 1px solid rgba(120, 180, 155, 0.34);
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        cursor: pointer;
        animation: slideInRight 0.3s ease-out;
      }

      .aletheia-notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .aletheia-icon {
        font-size: 18px;
        font-weight: bold;
      }

      .aletheia-text strong {
        display: block;
        margin-bottom: 2px;
      }

      .aletheia-text small {
        opacity: 0.8;
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Highlight animation for filled fields */
      @keyframes aletheiaFillPulse {
        0% { box-shadow: 0 0 0 0 rgba(90, 157, 130, 0.42); }
        70% { box-shadow: 0 0 0 6px rgba(90, 157, 130, 0); }
        100% { box-shadow: 0 0 0 0 rgba(90, 157, 130, 0); }
      }
    `;

    document.head.appendChild(style);
  }

  // Advanced Apollo.io specific handlers
  function handleApolloSpecificFilling(data) {
    // Apollo has some special cases we need to handle

    // Check if we're in a sequence builder
    const sequenceBuilder = document.querySelector(
      '[data-testid="sequence-step"]',
    );
    if (sequenceBuilder) {
      return handleApolloSequence(data);
    }

    // Check if we're in email composer
    const emailComposer = document.querySelector(
      '[data-testid="email-composer"]',
    );
    if (emailComposer) {
      return handleApolloEmail(data);
    }

    return false;
  }

  function handleApolloSequence(data) {
    // Apollo sequence steps often have dynamic selectors
    const activeStep = document.querySelector(
      '.step-editor.active, [data-testid="active-step"]',
    );

    if (activeStep) {
      const subjectInput = activeStep.querySelector(
        'input[placeholder*="subject"]',
      );
      const bodyArea = activeStep.querySelector(
        'textarea, div[contenteditable="true"]',
      );

      if (subjectInput && data.subject_line) {
        fillSingleField(subjectInput, data.subject_line);
      }

      if (bodyArea && data.body) {
        fillSingleField(bodyArea, data.body);
      }

      return true;
    }

    return false;
  }

  function handleApolloEmail(data) {
    // Handle Apollo's email composer interface
    const composer = document.querySelector('[data-testid="email-composer"]');

    if (composer) {
      const subjectInput = composer.querySelector(
        'input[name="subject"], input[placeholder*="Subject"]',
      );
      const bodyEditor = composer.querySelector(
        'div[contenteditable="true"], textarea',
      );

      if (subjectInput && data.subject_line) {
        fillSingleField(subjectInput, data.subject_line);
      }

      if (bodyEditor && data.body) {
        fillSingleField(bodyEditor, data.body);
      }

      return true;
    }

    return false;
  }

  function fillSingleField(element, content) {
    // Utility function for filling a single field with proper event handling
    element.focus();

    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      element.value = content;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (element.contentEditable === "true") {
      // For contenteditable elements, we need to handle it differently
      element.replaceChildren();
      const lines = String(content).split("\n");
      lines.forEach((line, index) => {
        if (index > 0) {
          element.appendChild(document.createElement("br"));
        }
        element.appendChild(document.createTextNode(line));
      });

      // Trigger the appropriate events
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    }

    highlightFilledElement(element);
  }

  // Handle page navigation and dynamic content changes
  let lastUrl = window.location.href;

  const checkForNavigation = () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;

      // Re-initialize on navigation for SPAs
      setTimeout(() => {
        reportDiagnostic("auto_filler.initialized", {
          platform: window.location.hostname.includes("apollo.io")
            ? "apollo"
            : "linkedin",
        });
      }, 1000);
    }
  };

  // Watch for navigation changes (important for SPAs like Apollo and LinkedIn)
  setInterval(checkForNavigation, 1000);
})();
