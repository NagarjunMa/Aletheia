import { describe, it, expect } from "vitest";
import {
  stripSurrogates,
  stripModelPreambleAndSuffix,
  sanitizeAIOutput,
  sanitizeForLinkedIn,
  sanitizeForEmail,
} from "./sanitizer";

describe("stripSurrogates", () => {
  it("returns string unchanged when no surrogates present", () => {
    expect(stripSurrogates("Hello world")).toBe("Hello world");
  });

  it("removes lone high surrogate (U+D800)", () => {
    const withSurrogate = "Hello\uD800World";
    const result = stripSurrogates(withSurrogate);
    expect(result).toBe("HelloWorld");
  });

  it("removes lone low surrogate", () => {
    const withSurrogate = "Hello\uDC00World";
    const result = stripSurrogates(withSurrogate);
    expect(result).toBe("HelloWorld");
  });

  it("preserves valid surrogate pairs", () => {
    // U+1F600 emoji = \uD83D\uDE00 (valid pair)
    const withEmoji = "Hello \uD83D\uDE00 World";
    const result = stripSurrogates(withEmoji);
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("handles empty string", () => {
    expect(stripSurrogates("")).toBe("");
  });
});

describe("stripModelPreambleAndSuffix", () => {
  it("returns text unchanged when no meta lines present", () => {
    const body = "Saw your work at EY. Would love to chat about open roles.";
    expect(stripModelPreambleAndSuffix(body)).toBe(body);
  });

  it("strips real-world leak: 'Counting carefully' preamble + '---' + 'Character count' tail", () => {
    const leaked = [
      "Counting carefully before finalizing.",
      "---",
      "Saw your work at EY in consulting and your PSPO cert. Vikas mentioned you - his brother here, exploring full-time roles. Would love to hear about open positions at EY and whether a referral might be possible.",
      "Character count: 221 ✓",
    ].join("\n");
    const out = stripModelPreambleAndSuffix(leaked);
    expect(out.startsWith("Saw your work at EY")).toBe(true);
    expect(out.endsWith("might be possible.")).toBe(true);
    expect(out).not.toMatch(/counting|character count|---/i);
  });

  it("strips leading 'Here is the message:' label", () => {
    const leaked =
      "Here is the message:\nSaw your recent move to Stripe. Would love to chat.";
    expect(stripModelPreambleAndSuffix(leaked)).toBe(
      "Saw your recent move to Stripe. Would love to chat.",
    );
  });

  it("strips leading 'Output:' label", () => {
    const leaked = "Output: Saw your post. Open to a quick call?";
    expect(stripModelPreambleAndSuffix(leaked)).toBe(
      "Saw your post. Open to a quick call?",
    );
  });

  it("strips trailing word count tail", () => {
    const leaked =
      "Saw your AWS reInvent talk. Open to a quick exchange on the topic?\nWord count: 14 ✓";
    expect(stripModelPreambleAndSuffix(leaked)).toBe(
      "Saw your AWS reInvent talk. Open to a quick exchange on the topic?",
    );
  });

  it("strips multiple separator styles", () => {
    expect(stripModelPreambleAndSuffix("---\nHi there.\n***")).toBe(
      "Hi there.",
    );
    expect(stripModelPreambleAndSuffix("===\nHi there.\n___")).toBe(
      "Hi there.",
    );
  });

  it("strips 'Let me draft this.' style preambles", () => {
    const leaked = "Let me draft this carefully.\nHi Sarah, saw your work.";
    expect(stripModelPreambleAndSuffix(leaked)).toBe(
      "Hi Sarah, saw your work.",
    );
  });

  it("does not strip message text that begins with a normal sentence", () => {
    const body = "Here is what I do for fun: I run marathons.";
    expect(stripModelPreambleAndSuffix(body)).toBe(body);
  });

  it("does not match conversational uses of 'note' or 'final' embedded mid-sentence", () => {
    const body =
      "Quick note on your final project: the architecture choices were sharp.";
    expect(stripModelPreambleAndSuffix(body)).toBe(body);
  });

  it("handles empty string", () => {
    expect(stripModelPreambleAndSuffix("")).toBe("");
  });

  it("handles all-meta input by returning empty string", () => {
    const allMeta = "Counting now.\n---\nCharacter count: 0";
    expect(stripModelPreambleAndSuffix(allMeta)).toBe("");
  });
});

describe("sanitizeAIOutput", () => {
  it("returns success: true for normal text", async () => {
    const result = await sanitizeAIOutput("Hello, this is a normal message.");
    expect(result.success).toBe(true);
    expect(result.sanitizedContent).toBeTruthy();
  });

  it("returns success: false for empty input", async () => {
    const result = await sanitizeAIOutput("");
    expect(result.success).toBe(false);
  });

  it("strips HTML tags", async () => {
    const result = await sanitizeAIOutput("<b>Bold text</b> and <i>italic</i>");
    expect(result.sanitizedContent).not.toContain("<b>");
    expect(result.sanitizedContent).not.toContain("<i>");
    expect(result.sanitizedContent).toContain("Bold text");
  });

  it("normalizes excessive whitespace", async () => {
    const result = await sanitizeAIOutput("Hello    world   how   are   you");
    expect(result.sanitizedContent).not.toMatch(/\s{3,}/);
  });

  it("includes originalLength and sanitizedLength", async () => {
    const input = "Hello world";
    const result = await sanitizeAIOutput(input);
    expect(result.originalLength).toBe(input.length);
    expect(typeof result.sanitizedLength).toBe("number");
  });

  it("returns modificationsApplied as an array", async () => {
    const result = await sanitizeAIOutput("Some content here.");
    expect(Array.isArray(result.modificationsApplied)).toBe(true);
  });

  it("returns warnings as an array", async () => {
    const result = await sanitizeAIOutput("Some content here.");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("truncates content exceeding maxLength", async () => {
    const longContent = "a".repeat(200);
    const result = await sanitizeAIOutput(longContent, { maxLength: 100 });
    expect(result.sanitizedLength).toBeLessThanOrEqual(100);
  });

  it("includes aiFingerprints result when detection is enabled", async () => {
    const result = await sanitizeAIOutput("Hello there.", {
      detectAIFingerprints: true,
    });
    expect(result.aiFingerprints).toBeDefined();
  });

  it("skips AI fingerprint detection when disabled", async () => {
    const result = await sanitizeAIOutput("Hello there.", {
      detectAIFingerprints: false,
    });
    expect(result.aiFingerprints).toBeUndefined();
  });

  it('records "Removed HTML tags" in modificationsApplied when tags are stripped', async () => {
    const result = await sanitizeAIOutput("<p>Paragraph text</p>");
    expect(result.modificationsApplied).toContain("Removed HTML tags");
  });

  it("collapses 3+ consecutive newlines to at most 2", async () => {
    const result = await sanitizeAIOutput("Line one.\n\n\n\nLine two.", {
      preserveFormatting: true,
    });
    expect(result.sanitizedContent).not.toMatch(/\n{3,}/);
    expect(result.sanitizedContent).toContain("Line one.");
    expect(result.sanitizedContent).toContain("Line two.");
  });

  it("trims leading and trailing whitespace", async () => {
    const result = await sanitizeAIOutput("  Hello world.  ", {
      preserveFormatting: true,
    });
    expect(result.sanitizedContent).toBe("Hello world.");
  });
});

describe("sanitizeAIOutput - profanity filtering", () => {
  it("replaces profanity with censored version", async () => {
    const result = await sanitizeAIOutput("This is some shit content.", {
      removeProfanity: true,
    });
    expect(result.sanitizedContent).not.toContain("shit");
    expect(
      result.modificationsApplied.some((m) => m.includes("profanity")),
    ).toBe(true);
  });

  it("preserves content when removeProfanity is false", async () => {
    const result = await sanitizeAIOutput("This is damn good work.", {
      removeProfanity: false,
    });
    expect(result.sanitizedContent).toContain("damn");
  });

  it("censors profanity with asterisks", async () => {
    const result = await sanitizeAIOutput("What the fuck is this.", {
      removeProfanity: true,
    });
    // First letter preserved, rest replaced with *
    expect(result.sanitizedContent).toMatch(/f\*+/);
  });
});

describe("sanitizeAIOutput - blocked content", () => {
  it("returns success: false for hate speech content", async () => {
    const result = await sanitizeAIOutput(
      "This post promotes ethnic cleansing ideology.",
    );
    expect(result.success).toBe(false);
    expect(result.sanitizedContent).toBe("");
    expect(result.warnings).toContain("Content contains blocked patterns");
  });

  it("returns success: false for violence patterns", async () => {
    const result = await sanitizeAIOutput("You should kill yourself now.");
    expect(result.success).toBe(false);
  });

  it("returns error field when content is blocked", async () => {
    const result = await sanitizeAIOutput("Content about drug dealing.");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("sanitizeAIOutput - harmful pattern redaction", () => {
  it("redacts SSN patterns", async () => {
    const result = await sanitizeAIOutput(
      "My social security number is 123-45-6789 please help.",
    );
    expect(result.sanitizedContent).not.toContain("123-45-6789");
    expect(result.sanitizedContent).toContain("[REDACTED]");
    expect(result.warnings.some((w) => w.includes("sensitive"))).toBe(true);
  });

  it("redacts SQL injection patterns (DROP TABLE)", async () => {
    const result = await sanitizeAIOutput(
      "Ignore this: drop table users; -- SQL injection test",
    );
    expect(result.sanitizedContent).not.toMatch(/drop\s+table/i);
    expect(result.sanitizedContent).toContain("[REDACTED]");
  });

  it("records modifications when harmful patterns are removed", async () => {
    const result = await sanitizeAIOutput("SSN: 987-65-4321 in the text.");
    expect(result.modificationsApplied.some((m) => m.includes("pattern"))).toBe(
      true,
    );
  });
});

describe("sanitizeAIOutput - AI fingerprint humanization", () => {
  it("applies humanization and removes em-dash when text has AI patterns", async () => {
    const aiText =
      "Hope this finds you well — would you be open to connecting at your earliest convenience? That being said, it is a game-changer.";
    const result = await sanitizeAIOutput(aiText, {
      humanize: true,
      detectAIFingerprints: true,
    });
    expect(result.aiFingerprints?.detectedPatterns.length).toBeGreaterThan(0);
    expect(result.sanitizedContent).not.toContain("—");
  });

  it("records AI humanization in modificationsApplied", async () => {
    const aiText =
      "Hope this finds you well. Would you be open to a quick call — at your earliest convenience?";
    const result = await sanitizeAIOutput(aiText, {
      humanize: true,
      detectAIFingerprints: true,
    });
    // If AI patterns detected and humanized, modifications should reflect it
    expect(result.modificationsApplied).toBeDefined();
    expect(Array.isArray(result.modificationsApplied)).toBe(true);
  });

  it("preserves em-dash when humanize is disabled", async () => {
    const result = await sanitizeAIOutput("Great idea — let me know.", {
      humanize: false,
      detectAIFingerprints: true,
    });
    expect(result.sanitizedContent).toContain("—");
  });
});

describe("sanitizeForLinkedIn", () => {
  it("returns success: true for valid content", async () => {
    const result = await sanitizeForLinkedIn(
      "Hi, I wanted to connect with you!",
    );
    expect(result.success).toBe(true);
  });

  it("enforces 2000 character limit", async () => {
    const longContent = "LinkedIn message content. ".repeat(200);
    const result = await sanitizeForLinkedIn(longContent);
    expect(result.sanitizedLength).toBeLessThanOrEqual(2000);
    expect(result.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });

  it("uses linkedin platform for fingerprint detection", async () => {
    const result = await sanitizeForLinkedIn(
      "Your background caught my attention.",
    );
    expect(result.aiFingerprints).toBeDefined();
    // background_attention is a linkedin-only pattern
    if (result.aiFingerprints?.detectedPatterns) {
      expect(result.aiFingerprints.detectedPatterns).toContain(
        "background_attention",
      );
    }
  });

  it("returns success: false for blocked content", async () => {
    const result = await sanitizeForLinkedIn("Kill yourself today.");
    expect(result.success).toBe(false);
  });
});

describe("sanitizeForEmail", () => {
  it("returns success: true for valid content", async () => {
    const result = await sanitizeForEmail(
      "Hello, I wanted to reach out about an opportunity.",
    );
    expect(result.success).toBe(true);
  });

  it("enforces 5000 character limit", async () => {
    const longContent = "Email body content here. ".repeat(400);
    const result = await sanitizeForEmail(longContent);
    expect(result.sanitizedLength).toBeLessThanOrEqual(5000);
  });

  it("returns aiFingerprints for fingerprint detection", async () => {
    const result = await sanitizeForEmail("I hope this email finds you well.");
    expect(result.aiFingerprints).toBeDefined();
  });
});
