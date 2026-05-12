import { describe, it, expect } from "vitest";
import {
  parseGenerationResponse,
  calculateCharCount,
  buildGeneratePayload,
  isAuthError,
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

  it("linkedin_connection: near limit (251-280)", () => {
    const result = calculateCharCount("x".repeat(260), "linkedin_connection");
    expect(result.isNearLimit).toBe(true);
    expect(result.isOverLimit).toBe(false);
  });

  it("linkedin_connection: over limit (>280)", () => {
    const result = calculateCharCount("x".repeat(290), "linkedin_connection");
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
});

// ─── buildGeneratePayload ───

describe("buildGeneratePayload", () => {
  it("assembles correct shape", () => {
    const profile = {
      profileMarkdown: "md",
      profileUrl: "https://li.com/in/test",
    };
    const result = buildGeneratePayload(
      profile,
      "resume text",
      "job desc",
      "cold_email",
      "networking",
      ["ex1"],
    );
    expect(result).toEqual({
      profileMarkdown: "md",
      profileUrl: "https://li.com/in/test",
      resume: "resume text",
      jd: "job desc",
      category: "cold_email",
      intent: "networking",
      acceptedExamples: ["ex1"],
    });
  });

  it("defaults empty strings for missing optional fields", () => {
    const profile = { profileMarkdown: "md", profileUrl: "url" };
    const result = buildGeneratePayload(
      profile,
      null,
      undefined,
      "linkedin_connection",
      "referral",
      null,
    );
    expect(result.resume).toBe("");
    expect(result.jd).toBe("");
    expect(result.acceptedExamples).toEqual([]);
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
