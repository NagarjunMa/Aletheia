// Popup Core — Pure functions extracted from popup.js for testability.
// No DOM access, no chrome.* calls — just data transformations.

export const YC_APPLICATION_CATEGORY = "yc_application";
export const DEFAULT_YC_APPLICATION_QUESTION =
  "Why are you a strong candidate for this role?";
export const YC_APPLICATION_JOB_DESCRIPTION_MIN_CHARS = 80;
export const YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS = 20000;
export const YC_APPLICATION_QUESTION_MIN_CHARS = 10;
export const YC_APPLICATION_QUESTION_MAX_CHARS = 1000;
export const YC_APPLICATION_MIN_WORDS = 50;
export const YC_APPLICATION_MAX_WORDS = 150;

function countWords(text) {
  const normalized = String(text || "").trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

/**
 * Parse a generation response, extracting JSON for cold_email/inmail.
 */
export function parseGenerationResponse(output) {
  const processed = { ...output };

  if (
    (output.category === "cold_email" ||
      output.category === "linkedin_inmail") &&
    typeof output.body === "string"
  ) {
    try {
      let jsonString = output.body.trim();

      if (jsonString.startsWith("```json")) {
        jsonString = jsonString
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      if (jsonString.startsWith("{") || jsonString.startsWith('"')) {
        const parsed = JSON.parse(jsonString);
        if (parsed.subject_line || parsed.body) {
          processed.subject_line = parsed.subject_line || output.subject_line;
          processed.body = parsed.body || output.body;
        }
      }
    } catch {
      // JSON parse failed — keep original body
    }
  }

  return processed;
}

/**
 * Calculate character or word-count info for a given category.
 * Returns { count, displayText, isOverLimit, isNearLimit }.
 */
export function calculateCharCount(text, category) {
  const count =
    category === YC_APPLICATION_CATEGORY ? countWords(text) : text.length;
  let isOverLimit = false;
  let isNearLimit = false;
  let displayText;

  switch (category) {
    case "linkedin_connection":
      isOverLimit = count > 300;
      isNearLimit = !isOverLimit && count > 270;
      displayText = `${count}/300`;
      break;
    case "linkedin_inmail":
      isOverLimit = count > 1800;
      displayText = `${count} chars`;
      break;
    case "cold_email":
      isOverLimit = count > 1500;
      displayText = `${count} chars`;
      break;
    case YC_APPLICATION_CATEGORY:
      isOverLimit = count > YC_APPLICATION_MAX_WORDS;
      displayText = `${count} words · ${YC_APPLICATION_MIN_WORDS}–${YC_APPLICATION_MAX_WORDS}`;
      break;
    default:
      displayText = `${count} chars`;
  }

  return { count, displayText, isOverLimit, isNearLimit };
}

/**
 * Build generate request payload.
 */
export function buildGeneratePayload(
  profile,
  _resume,
  contextValue,
  category,
  intent,
  acceptedExamples,
  emailMode = "initial_outreach",
  questionValue = DEFAULT_YC_APPLICATION_QUESTION,
) {
  if (category === YC_APPLICATION_CATEGORY) {
    return {
      category: YC_APPLICATION_CATEGORY,
      jd: String(contextValue || "").trim(),
      question:
        String(questionValue || "").trim() || DEFAULT_YC_APPLICATION_QUESTION,
    };
  }

  const isFollowUp = emailMode === "follow_up";
  return {
    profileMarkdown: profile.profileMarkdown,
    profileUrl: profile.profileUrl,
    jd: isFollowUp ? "" : contextValue || "",
    conversationContext: isFollowUp ? contextValue || "" : "",
    category,
    intent,
    emailMode,
    acceptedExamples: acceptedExamples || [],
  };
}

/**
 * Describe the category-specific popup state without touching the DOM.
 */
export function getCategoryUiState(category, emailMode = "initial_outreach") {
  if (category === YC_APPLICATION_CATEGORY) {
    return {
      requiresLinkedInProfile: false,
      showIntent: false,
      showEmailMode: false,
      showQuestion: true,
      contextRequired: true,
      contextLabel: "Job Description",
      contextPlaceholder:
        "Paste the complete YC startup job description (minimum 80 characters)...",
      contextMaxLength: YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS,
      generateLabel: "Generate YC Answer",
      outputLabel: "Application Answer",
      showAutoFill: false,
    };
  }

  const isFollowUp =
    category !== "linkedin_connection" && emailMode === "follow_up";
  const labels = {
    linkedin_connection: "Generate Connection Request",
    cold_email: "Generate Cold Email",
    linkedin_inmail: "Generate InMail",
  };

  return {
    requiresLinkedInProfile: true,
    showIntent: true,
    showEmailMode: category !== "linkedin_connection",
    showQuestion: false,
    contextRequired: false,
    contextLabel: isFollowUp
      ? "Previous Conversation (Optional)"
      : "Job Description (Optional)",
    contextPlaceholder: isFollowUp
      ? "Paste prior emails or replies for follow-up context..."
      : "Paste job description to create more targeted messages...",
    contextMaxLength: isFollowUp ? 12000 : 2000,
    generateLabel: labels[category] || "Generate Message",
    outputLabel: "Message",
    showAutoFill: true,
  };
}

/**
 * Validate only the user inputs the popup owns. Server validation remains the
 * authority, but these checks prevent avoidable requests and explain recovery.
 */
export function validateGenerationInput({
  category,
  hasProfile,
  contextValue,
  questionValue,
}) {
  if (category !== YC_APPLICATION_CATEGORY) {
    return hasProfile
      ? { valid: true }
      : {
          valid: false,
          code: "LINKEDIN_PROFILE_REQUIRED",
          message:
            "No LinkedIn profile detected. Navigate to a LinkedIn profile first.",
        };
  }

  const jd = String(contextValue || "").trim();
  const question =
    String(questionValue || "").trim() || DEFAULT_YC_APPLICATION_QUESTION;

  if (jd.length < YC_APPLICATION_JOB_DESCRIPTION_MIN_CHARS) {
    return {
      valid: false,
      code: "YC_JOB_DESCRIPTION_TOO_SHORT",
      message: `Paste at least ${YC_APPLICATION_JOB_DESCRIPTION_MIN_CHARS} characters of the job description.`,
    };
  }
  if (jd.length > YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS) {
    return {
      valid: false,
      code: "YC_JOB_DESCRIPTION_TOO_LONG",
      message: `Keep the job description under ${YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-US")} characters.`,
    };
  }
  if (question.length < YC_APPLICATION_QUESTION_MIN_CHARS) {
    return {
      valid: false,
      code: "YC_QUESTION_TOO_SHORT",
      message: `Enter an application question with at least ${YC_APPLICATION_QUESTION_MIN_CHARS} characters.`,
    };
  }
  if (question.length > YC_APPLICATION_QUESTION_MAX_CHARS) {
    return {
      valid: false,
      code: "YC_QUESTION_TOO_LONG",
      message: `Keep the application question under ${YC_APPLICATION_QUESTION_MAX_CHARS.toLocaleString("en-US")} characters.`,
    };
  }
  return { valid: true };
}

/**
 * Convert API failures into a stable display model for the popup.
 */
export function getGenerationErrorPresentation(response) {
  const message =
    response?.message ||
    response?.error ||
    "Generation failed. Please try again.";

  if (
    response?.code === "GROUNDING_PROFILE_INCOMPLETE" &&
    response?.applicationProfileUrl
  ) {
    return {
      message,
      actionLabel: "Complete application profile",
      actionUrl: response.applicationProfileUrl,
      missingFields: response.missingFields || [],
      recommendedFields: response.recommendedFields || [],
    };
  }

  if (
    (response?.code === "EXTENSION_UPDATE_REQUIRED" ||
      response?.code === "API_VERSION_UNSUPPORTED") &&
    response?.updateUrl
  ) {
    return {
      message,
      actionLabel: "Update extension",
      actionUrl: response.updateUrl,
      missingFields: [],
      recommendedFields: [],
    };
  }

  return {
    message,
    actionLabel: "",
    actionUrl: "",
    missingFields: [],
    recommendedFields: [],
  };
}

/**
 * Check if an error message indicates an auth issue.
 */
export function isAuthError(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("not authenticated") ||
    lower.includes("unauthorized") ||
    lower.includes("auth_failed") ||
    lower.includes("session expired") ||
    lower.includes("please log in")
  );
}
