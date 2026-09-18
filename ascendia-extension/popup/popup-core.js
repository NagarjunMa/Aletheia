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
export function parseGenerationResponse(output, expectedQuestions) {
  const processed = { ...output };
  if (
    expectedQuestions &&
    (output.category !== YC_APPLICATION_CATEGORY ||
      (expectedQuestions.length > 1 && !Array.isArray(output.answers)))
  ) {
    throw new Error(
      "The returned answers do not match the submitted questions.",
    );
  }
  if (
    output.category === YC_APPLICATION_CATEGORY &&
    output.answers !== undefined
  ) {
    if (
      !Array.isArray(output.answers) ||
      output.answers.length < 1 ||
      output.answers.length > 5
    )
      throw new Error("Invalid application answers");
    const answers = [...output.answers].sort((a, b) =>
      String(a.questionId).localeCompare(String(b.questionId)),
    );
    const restored = answers.every((answer) => answer.question === undefined);
    if (
      expectedQuestions &&
      (answers.length !== expectedQuestions.length ||
        answers.some(
          (answer, index) => answer.question !== expectedQuestions[index],
        ))
    ) {
      throw new Error(
        "The returned answers do not match the submitted questions.",
      );
    }
    for (const [index, answer] of answers.entries()) {
      if (
        answer.questionId !== `q${index + 1}` ||
        typeof answer.body !== "string" ||
        answer.body.length > 3000 ||
        countWords(answer.body) < 50 ||
        countWords(answer.body) > 150 ||
        answer.word_count !== countWords(answer.body) ||
        answer.character_count !== answer.body.length ||
        (!restored &&
          (typeof answer.question !== "string" ||
            answer.question.length < 10 ||
            answer.question.length > 1000))
      ) {
        throw new Error("Invalid application answer contract");
      }
    }
    processed.answers = answers;
    processed.body = restored
      ? answers.map((answer) => answer.body).join("\n\n")
      : formatApplicationAnswers(answers);
    return processed;
  }

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
  questionValue = "",
) {
  if (category === YC_APPLICATION_CATEGORY) {
    return {
      category: YC_APPLICATION_CATEGORY,
      jd: normalizeApplicationInput(contextValue),
      questions: parseApplicationQuestions(questionValue),
    };
  }

  const isFollowUp = emailMode === "follow_up";
  return {
    profileMarkdown: profile.profileMarkdown,
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
        "Paste the complete job description (minimum 80 characters)...",
      contextMaxLength: YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS,
      generateLabel: "Generate Answers · 4 credits",
      outputLabel: "Application Answers",
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

  const jd = normalizeApplicationInput(contextValue);
  const questions = parseApplicationQuestions(questionValue);

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
  if (questions.length === 0 || questions.length > 5)
    return {
      valid: false,
      code: "YC_QUESTION_COUNT_INVALID",
      message: "Enter one to five questions, one per line.",
    };
  for (const [index, question] of questions.entries()) {
    if (question.length < 10 || question.length > 500)
      return {
        valid: false,
        code:
          question.length < 10
            ? "YC_QUESTION_TOO_SHORT"
            : "YC_QUESTION_TOO_LONG",
        message: `Question ${index + 1} must contain 10–500 characters.`,
      };
  }
  return { valid: true };
}

/**
 * Convert API failures into a stable display model for the popup.
 */
export function getGenerationErrorPresentation(response) {
  const message =
    (response?.billing === "refund_pending"
      ? `Generation failed. Credit restoration pending manual review.${response.refundReference ? ` Reference: ${response.refundReference}` : ""}`
      : "") ||
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
    lower.includes("auth_required") ||
    lower.includes("auth_timeout") ||
    lower.includes("session_") ||
    lower.includes("session expired") ||
    lower.includes("please log in")
  );
}

export function normalizeApplicationInput(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .trim();
}

export function parseApplicationQuestions(value) {
  return normalizeApplicationInput(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatApplicationAnswers(answers) {
  if (answers.length === 1) return answers[0].body;
  return answers
    .map(
      ({ question, body }) =>
        `**${question.replace(/([\\`*_{}[\]()<>#+.!|~-])/gu, "\\$1")}**\n${body}`,
    )
    .join("\n\n");
}

const APPLICATION_METADATA_FIELDS = [
  "generationId",
  "promptVersion",
  "model",
  "category",
  "generationTimeMs",
  "inputTokens",
  "outputTokens",
  "profileFieldCount",
  "confirmedEvidenceCount",
  "resumeSource",
  "injectionTriggered",
  "groundingValidationPassed",
];
export function applicationMetadata(output) {
  if (!output.evalMetadata) return undefined;
  return Object.fromEntries(
    APPLICATION_METADATA_FIELDS.filter((key) =>
      ["string", "number", "boolean"].includes(typeof output.evalMetadata[key]),
    ).map((key) => [key, output.evalMetadata[key]]),
  );
}

export function projectStoredApplication(output) {
  const parsed = parseGenerationResponse(output);
  const answers = parsed.answers?.map(
    ({ questionId, body, word_count, character_count }) => ({
      questionId,
      body,
      word_count,
      character_count,
    }),
  );
  const body = answers
    ? answers.map((answer) => answer.body).join("\n\n")
    : parsed.body;
  return {
    category: YC_APPLICATION_CATEGORY,
    body,
    ...(answers ? { answers } : {}),
    word_count: countWords(body),
    character_count: body.length,
    ...(applicationMetadata(output)
      ? { evalMetadata: applicationMetadata(output) }
      : {}),
  };
}

export function buildApplicationFeedback(
  output,
  approved,
  issueCategory,
  summary,
) {
  const metadata = applicationMetadata(output);
  if (!metadata?.generationId)
    throw new Error(
      "This saved answer has no generation reference. Generate again before reporting feedback.",
    );
  return {
    format: "application_summary",
    category: YC_APPLICATION_CATEGORY,
    approved,
    generationId: metadata.generationId,
    evalMetadata: metadata,
    ...(!approved
      ? { issueCategory, summary: String(summary ?? "").trim() }
      : {}),
  };
}

export {
  APPLICATION_AUTH_DRAFT_KEY,
  APPLICATION_AUTH_DRAFT_TTL_MS,
  buildApplicationAuthDraft,
  readApplicationAuthDraft,
} from "../lib/application-auth-draft.js";
