import { describe, it, expect } from "vitest";
import { feedbackSchema } from "./schema";

describe("feedbackSchema", () => {
  const validPayload = {
    message: "Hello, I wanted to reach out about your background.",
    approved: true,
    category: "linkedin_connection",
  };

  it("parses a valid payload", () => {
    const result = feedbackSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("parses with optional subjectLine", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      subjectLine: "Re: Opportunity",
    });
    expect(result.success).toBe(true);
  });

  it("parses with optional rejectionReason", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      approved: false,
      rejectionReason: "too_formal",
    });
    expect(result.success).toBe(true);
  });

  it("passes without rejectionReason (it is optional)", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      approved: false,
    });
    expect(result.success).toBe(true);
  });

  it("fails when message is missing", () => {
    const { message: _, ...withoutMessage } = validPayload;
    const result = feedbackSchema.safeParse(withoutMessage);
    expect(result.success).toBe(false);
  });

  it("fails when message is empty string", () => {
    const result = feedbackSchema.safeParse({ ...validPayload, message: "" });
    expect(result.success).toBe(false);
  });

  it("fails when approved is missing", () => {
    const { approved: _, ...withoutApproved } = validPayload;
    const result = feedbackSchema.safeParse(withoutApproved);
    expect(result.success).toBe(false);
  });

  it("fails when category is invalid", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      category: "instagram_post",
    });
    expect(result.success).toBe(false);
  });

  it("fails when rejectionReason is an invalid value", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      rejectionReason: "not_a_reason",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid category values", () => {
    const categories = ["linkedin_connection", "cold_email", "linkedin_inmail"];
    for (const category of categories) {
      const result = feedbackSchema.safeParse({ ...validPayload, category });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid rejectionReason values", () => {
    const reasons = ["too_formal", "too_generic", "wrong_tone"];
    for (const rejectionReason of reasons) {
      const result = feedbackSchema.safeParse({
        ...validPayload,
        rejectionReason,
      });
      expect(result.success).toBe(true);
    }
  });

  it("parses with optional evalMetadata block", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      evalMetadata: {
        promptVersion: "1.0.0",
        model: "claude-sonnet-4-6",
        temperature: 0.8,
        category: "linkedin_connection",
        intent: "networking",
        generationTimeMs: 1234,
        inputTokens: 500,
        outputTokens: 200,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects evalMetadata with missing required field", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      evalMetadata: {
        promptVersion: "1.0.0",
        model: "claude-sonnet-4-6",
        // missing temperature, category, intent, generationTimeMs, etc.
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects evalMetadata with unknown extra field (strict mode)", () => {
    const result = feedbackSchema.safeParse({
      ...validPayload,
      evalMetadata: {
        promptVersion: "1.0.0",
        model: "claude-sonnet-4-6",
        temperature: 0.8,
        category: "linkedin_connection",
        intent: "networking",
        generationTimeMs: 1234,
        inputTokens: 500,
        outputTokens: 200,
        nefarious: "inject me",
      },
    });
    expect(result.success).toBe(false);
  });
});
