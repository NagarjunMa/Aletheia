import { describe, it, expect } from "vitest";
import {
  DEFAULT_YC_APPLICATION_QUESTION,
  parseGenerationResponse,
  calculateCharCount,
  buildGeneratePayload,
  getCategoryUiState,
  getGenerationErrorPresentation,
  isAuthError,
  validateGenerationInput,
} from "./popup-core.js";

// ─── parseGenerationResponse ───

describe("parseGenerationResponse", () => {
  it("returns output unchanged for linkedin_connection", () => {
    const output = { body: "Hello!", category: "linkedin_connection" };
    const result = parseGenerationResponse(output);
    expect(result.body).toBe("Hello!");
  });

  it("extracts JSON from cold_email body", () => {
    const output = {
      body: '{"subject_line": "Hi", "body": "Hello there"}',
      category: "cold_email",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("Hi");
    expect(result.body).toBe("Hello there");
  });

  it("strips ```json code fences", () => {
    const output = {
      body: '```json\n{"subject_line": "Test", "body": "Content"}\n```',
      category: "cold_email",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("Test");
    expect(result.body).toBe("Content");
  });

  it("strips plain ``` code fences", () => {
    const output = {
      body: '```\n{"subject_line": "A", "body": "B"}\n```',
      category: "linkedin_inmail",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("A");
  });

  it("keeps original body when JSON parse fails", () => {
    const output = { body: "not json at all", category: "cold_email" };
    const result = parseGenerationResponse(output);
    expect(result.body).toBe("not json at all");
  });

  it("preserves existing subject_line when parsed JSON has none", () => {
    const output = {
      body: '{"body": "Hello"}',
      category: "cold_email",
      subject_line: "Original",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("Original");
    expect(result.body).toBe("Hello");
  });

  it("does not parse JSON for non-email categories", () => {
    const output = {
      body: '{"subject_line": "Nope", "body": "Ignored"}',
      category: "linkedin_connection",
    };
    const result = parseGenerationResponse(output);
    // Body should remain as the raw JSON string
    expect(result.body).toContain("Nope");
  });
});

// ─── calculateCharCount ───

describe("calculateCharCount", () => {
  it("linkedin_connection: under limit", () => {
    const result = calculateCharCount("x".repeat(200), "linkedin_connection");
    expect(result.count).toBe(200);
    expect(result.isOverLimit).toBe(false);
    expect(result.isNearLimit).toBe(false);
    expect(result.displayText).toBe("200/300");
  });

  it("linkedin_connection: near limit (271-300)", () => {
    const result = calculateCharCount("x".repeat(280), "linkedin_connection");
    expect(result.isNearLimit).toBe(true);
    expect(result.isOverLimit).toBe(false);
  });

  it("linkedin_connection: over limit (>300)", () => {
    const result = calculateCharCount("x".repeat(301), "linkedin_connection");
    expect(result.isOverLimit).toBe(true);
    expect(result.isNearLimit).toBe(false);
  });

  it("cold_email: over limit (>1500)", () => {
    const result = calculateCharCount("x".repeat(1600), "cold_email");
    expect(result.isOverLimit).toBe(true);
    expect(result.displayText).toBe("1600 chars");
  });

  it("linkedin_inmail: under limit", () => {
    const result = calculateCharCount("short", "linkedin_inmail");
    expect(result.isOverLimit).toBe(false);
    expect(result.displayText).toBe("5 chars");
  });

  it("unknown category: never over limit", () => {
    const result = calculateCharCount("x".repeat(5000), "unknown");
    expect(result.isOverLimit).toBe(false);
  });

  it("yc_application: reports the 50-150 word target", () => {
    const result = calculateCharCount(
      Array.from({ length: 72 }, (_, index) => `word${index}`).join(" "),
      "yc_application",
    );

    expect(result.count).toBe(72);
    expect(result.displayText).toBe("72 words · 50–150");
    expect(result.isOverLimit).toBe(false);
    expect(result.isNearLimit).toBe(false);
  });

  it("yc_application: flags answers above 150 words", () => {
    const result = calculateCharCount(
      Array.from({ length: 151 }, (_, index) => `word${index}`).join(" "),
      "yc_application",
    );

    expect(result.isOverLimit).toBe(true);
  });
});

// ─── buildGeneratePayload ───

describe("buildGeneratePayload", () => {
  it("assembles correct shape", () => {
    const profile = {
      profileMarkdown: "md",
    };
    const result = buildGeneratePayload(
      profile,
      "resume text",
      "job desc",
      "cold_email",
      "networking",
      ["ex1"],
      "role_fit_summary",
    );
    expect(result).toEqual({
      profileMarkdown: "md",
      jd: "job desc",
      conversationContext: "",
      category: "cold_email",
      intent: "networking",
      emailMode: "role_fit_summary",
      acceptedExamples: ["ex1"],
    });
  });

  it("uses the shared context textarea as conversationContext for follow-ups", () => {
    const profile = {
      profileMarkdown: "md",
    };
    const result = buildGeneratePayload(
      profile,
      "resume text",
      "Previous thread",
      "cold_email",
      "networking",
      [],
      "follow_up",
    );

    expect(result.jd).toBe("");
    expect(result.conversationContext).toBe("Previous thread");
    expect(result).not.toHaveProperty("resume");
  });

  it("defaults empty strings for missing optional fields", () => {
    const profile = { profileMarkdown: "md" };
    const result = buildGeneratePayload(
      profile,
      null,
      undefined,
      "linkedin_connection",
      "referral",
      null,
    );
    expect(result.jd).toBe("");
    expect(result.conversationContext).toBe("");
    expect(result.emailMode).toBe("initial_outreach");
    expect(result.acceptedExamples).toEqual([]);
  });

  it("builds a strict YC payload without LinkedIn or style-learning data", () => {
    const result = buildGeneratePayload(
      null,
      null,
      "  Build an AI operations product with a small team and own customer discovery through production delivery.  ",
      "yc_application",
      "networking",
      ["do not send this"],
      "initial_outreach",
      "  Why are you a great fit for this role?  ",
    );

    expect(result).toEqual({
      category: "yc_application",
      jd: "Build an AI operations product with a small team and own customer discovery through production delivery.",
      question: "Why are you a great fit for this role?",
    });
    expect(result).not.toHaveProperty("profileMarkdown");
    expect(result).not.toHaveProperty("acceptedExamples");
  });

  it("uses the server-aligned default YC question", () => {
    const result = buildGeneratePayload(
      null,
      null,
      "A sufficiently detailed job description for an early-stage product engineering role with customer ownership.",
      "yc_application",
      "networking",
      [],
      "initial_outreach",
      "",
    );

    expect(result.question).toBe(DEFAULT_YC_APPLICATION_QUESTION);
  });
});

describe("YC category UI and validation", () => {
  it("does not require a LinkedIn profile and exposes only YC inputs", () => {
    expect(getCategoryUiState("yc_application", "initial_outreach")).toEqual(
      expect.objectContaining({
        requiresLinkedInProfile: false,
        showIntent: false,
        showEmailMode: false,
        showQuestion: true,
        contextRequired: true,
        contextMaxLength: 20000,
        generateLabel: "Generate YC Answer",
        outputLabel: "Application Answer",
        showAutoFill: false,
      }),
    );
  });

  it("requires an 80-character YC job description", () => {
    expect(
      validateGenerationInput({
        category: "yc_application",
        hasProfile: false,
        contextValue: "Too short",
        questionValue: DEFAULT_YC_APPLICATION_QUESTION,
      }),
    ).toMatchObject({ valid: false, code: "YC_JOB_DESCRIPTION_TOO_SHORT" });
  });

  it("allows YC generation on a non-LinkedIn page when inputs are ready", () => {
    expect(
      validateGenerationInput({
        category: "yc_application",
        hasProfile: false,
        contextValue:
          "Build and operate an AI product with a small YC startup team while working closely with customers from idea through production.",
        questionValue: DEFAULT_YC_APPLICATION_QUESTION,
      }),
    ).toEqual({ valid: true });
  });

  it("keeps the existing LinkedIn profile requirement for legacy categories", () => {
    expect(
      validateGenerationInput({
        category: "cold_email",
        hasProfile: false,
        contextValue: "",
        questionValue: "",
      }),
    ).toMatchObject({ valid: false, code: "LINKEDIN_PROFILE_REQUIRED" });
  });
});

describe("getGenerationErrorPresentation", () => {
  it("turns incomplete grounding into a dashboard action", () => {
    expect(
      getGenerationErrorPresentation({
        success: false,
        error: "Candidate profile incomplete",
        code: "GROUNDING_PROFILE_INCOMPLETE",
        message: "Add more evidence before generating this answer.",
        missingFields: ["Current role", "Strongest achievements"],
        recommendedFields: ["Most difficult project"],
        applicationProfileUrl: "https://www.aletheia.live/profile/application",
      }),
    ).toEqual({
      message: "Add more evidence before generating this answer.",
      actionLabel: "Complete application profile",
      actionUrl: "https://www.aletheia.live/profile/application",
      missingFields: ["Current role", "Strongest achievements"],
      recommendedFields: ["Most difficult project"],
    });
  });

  it("turns unsupported extension versions into a store update action", () => {
    expect(
      getGenerationErrorPresentation({
        success: false,
        code: "EXTENSION_UPDATE_REQUIRED",
        message: "Update Aletheia to continue.",
        updateUrl:
          "https://chrome.google.com/webstore/detail/aletheia/pneenlhefkghefjpaafgllkjkpfjnkgg",
      }),
    ).toEqual({
      message: "Update Aletheia to continue.",
      actionLabel: "Update extension",
      actionUrl:
        "https://chrome.google.com/webstore/detail/aletheia/pneenlhefkghefjpaafgllkjkpfjnkgg",
      missingFields: [],
      recommendedFields: [],
    });
  });
});

// ─── isAuthError ───

describe("isAuthError", () => {
  it("detects auth_failed", () => {
    expect(isAuthError("AUTH_FAILED: Please log in")).toBe(true);
  });

  it("detects session expired", () => {
    expect(isAuthError("Session expired")).toBe(true);
  });

  it("detects unauthorized", () => {
    expect(isAuthError("Unauthorized")).toBe(true);
  });

  it("returns false for null/undefined", () => {
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });

  it("returns false for generic errors", () => {
    expect(isAuthError("Network error")).toBe(false);
    expect(isAuthError("Rate limit exceeded")).toBe(false);
  });
});
