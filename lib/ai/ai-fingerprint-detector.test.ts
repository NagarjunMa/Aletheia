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

  // Coverage backfill — 11 patterns previously untested
  describe("coverage backfill — 11 previously-untested patterns", () => {
    it("detects ellipsis character (…)", () => {
      const result = detectAIFingerprints(
        "This is interesting… and surprising.",
        "general",
      );
      expect(result.detectedPatterns).toContain("ellipsis_character");
    });

    it("detects ai_disclaimer (I'll keep this short/brief/concise)", () => {
      const result = detectAIFingerprints(
        "I'll keep this short. Wanted to introduce myself.",
        "general",
      );
      expect(result.detectedPatterns).toContain("ai_disclaimer");
    });

    it("detects ai_courtesy_closing (appreciate it either way)", () => {
      const result = detectAIFingerprints(
        "Happy to chat — appreciate it either way.",
        "general",
      );
      expect(result.detectedPatterns).toContain("ai_courtesy_closing");
    });

    it("detects linkedin_post_reference (linkedin platform)", () => {
      const text = "I found your scaling post on LinkedIn last week.";
      const result = detectAIFingerprints(text, "linkedin");
      expect(result.detectedPatterns).toContain("linkedin_post_reference");
    });

    it("detects hesitate_phrase (email platform)", () => {
      const text = "Please don't hesitate to reach out with any questions.";
      const result = detectAIFingerprints(text, "email");
      expect(result.detectedPatterns).toContain("hesitate_phrase");
    });

    it("detects perfect_paragraph_breaks (3+ paragraphs each starting uppercase)", () => {
      const text =
        "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.\n\nFourth paragraph here.";
      const result = detectAIFingerprints(text, "general");
      expect(result.detectedPatterns).toContain("perfect_paragraph_breaks");
    });

    it("detects list_introduction (Here are some …)", () => {
      const text = "Here are some thoughts on your work.";
      const result = detectAIFingerprints(text, "general");
      expect(result.detectedPatterns).toContain("list_introduction");
    });

    it("detects excessive_formality (I would be delighted to)", () => {
      const result = detectAIFingerprints(
        "I would be delighted to connect.",
        "general",
      );
      expect(result.detectedPatterns).toContain("excessive_formality");
    });

    it("detects ai_transition_mind (with that in mind)", () => {
      const result = detectAIFingerprints(
        "With that in mind, I wanted to reach out.",
        "general",
      );
      expect(result.detectedPatterns).toContain("ai_transition_mind");
    });

    it("detects ai_resonance (really resonates with)", () => {
      const result = detectAIFingerprints(
        "Your work really resonates with what we are building.",
        "general",
      );
      expect(result.detectedPatterns).toContain("ai_resonance");
    });

    it("detects ai_first_approach (AI-first approach)", () => {
      const result = detectAIFingerprints(
        "Your AI-first approach to ML infra is impressive.",
        "general",
      );
      expect(result.detectedPatterns).toContain("ai_first_approach");
    });
  });
});
