import { describe, it, expect } from "vitest";
import { detectAIFingerprints } from "./ai-fingerprint-detector";

describe("detectAIFingerprints", () => {
  it("returns the correct result shape", () => {
    const result = detectAIFingerprints(
      "Hello, I wanted to reach out.",
      "general",
    );
    expect(result).toHaveProperty("detectedPatterns");
    expect(result).toHaveProperty("sanitizedContent");
    expect(result).toHaveProperty("modifications");
    expect(result).toHaveProperty("warnings");
    expect(Array.isArray(result.detectedPatterns)).toBe(true);
  });

  it('detects "hope this finds you well" pattern (ai_hope_phrase)', () => {
    const text = "Hope this finds you well. I wanted to reach out.";
    const result = detectAIFingerprints(text, "general");
    expect(result.detectedPatterns).toContain("ai_hope_phrase");
  });

  it("detects em-dash as AI fingerprint (em_dash_usage)", () => {
    const text =
      "I am reaching out — I believe this is a great opportunity — to connect.";
    const result = detectAIFingerprints(text, "general");
    expect(result.detectedPatterns).toContain("em_dash_usage");
  });

  it('detects "would you be open to" pattern (ai_politeness)', () => {
    const text = "Would you be open to a quick chat about this?";
    const result = detectAIFingerprints(text, "general");
    expect(result.detectedPatterns).toContain("ai_politeness");
  });

  it('detects "at your earliest convenience" pattern (formal_convenience)', () => {
    const text = "Please respond at your earliest convenience.";
    const result = detectAIFingerprints(text, "general");
    expect(result.detectedPatterns).toContain("formal_convenience");
  });

  it("detects corporate buzzwords (showcasing)", () => {
    const text = "I've been showcasing my work to various companies.";
    const result = detectAIFingerprints(text, "general");
    expect(result.detectedPatterns).toContain("corporate_buzzwords");
  });

  it('detects "that being said" transition (ai_transition)', () => {
    const text =
      "I know you are busy. That being said, I think this is valuable.";
    const result = detectAIFingerprints(text, "general");
    expect(result.detectedPatterns).toContain("ai_transition");
  });

  it("detects superlative buzzwords (game-changer)", () => {
    const text = "This technology is a game-changer for the industry.";
    const result = detectAIFingerprints(text, "general");
    expect(result.detectedPatterns).toContain("superlative_buzzwords");
  });

  it("accepts different platform values without throwing", () => {
    expect(() => detectAIFingerprints("Hello.", "linkedin")).not.toThrow();
    expect(() => detectAIFingerprints("Hello.", "email")).not.toThrow();
    expect(() => detectAIFingerprints("Hello.", "general")).not.toThrow();
  });

  it("sanitizedContent replaces em-dash with hyphen", () => {
    const result = detectAIFingerprints("Great idea — let me know.", "general");
    expect(result.sanitizedContent).not.toContain("—");
    expect(result.sanitizedContent).toContain(" - ");
  });

  it("sanitizedContent is always a string", () => {
    const result = detectAIFingerprints("Some text here.", "general");
    expect(typeof result.sanitizedContent).toBe("string");
  });

  it("email_greeting pattern only fires on email platform", () => {
    const text = "I hope this email finds you well.";
    const generalResult = detectAIFingerprints(text, "general");
    const emailResult = detectAIFingerprints(text, "email");
    expect(generalResult.detectedPatterns).not.toContain("email_greeting");
    expect(emailResult.detectedPatterns).toContain("email_greeting");
  });

  it("background_attention pattern only fires on linkedin platform", () => {
    const text = "Your background caught my attention and I wanted to connect.";
    const generalResult = detectAIFingerprints(text, "general");
    const linkedinResult = detectAIFingerprints(text, "linkedin");
    expect(generalResult.detectedPatterns).not.toContain(
      "background_attention",
    );
    expect(linkedinResult.detectedPatterns).toContain("background_attention");
  });
});
