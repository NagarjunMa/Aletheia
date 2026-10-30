import { describe, expect, it, vi } from "vitest";
const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info, warn }),
  startTimedStage: () => () => {},
}));
import { inspectGroundedText, sanitizeAIOutput } from "./sanitizer";

describe("output safety repeatability", () => {
  it("rejects the same blocked content on every attempt", async () => {
    const results = [];
    for (let i = 0; i < 3; i++)
      results.push((await sanitizeAIOutput("nazi")).success);
    expect(results).toEqual([false, false, false]);
  });
  it.each([
    "nazi",
    "123-45-6789",
    "javascript:alert(1)",
    "<script>\nalert(1)\n</script>",
    "test@example.test",
    "bad\ud800encoding",
  ])("rejects unsafe grounded text without logging it", (text) => {
    info.mockClear();
    warn.mockClear();
    for (let attempt = 0; attempt < 3; attempt++)
      expect(() => inspectGroundedText(text, "general")).toThrow();
    expect(JSON.stringify([info.mock.calls, warn.mock.calls])).not.toContain(
      text,
    );
  });
  it.each(["linkedin", "email", "general"] as const)(
    "detects style without editing %s technical text or logging content",
    (platform) => {
      info.mockClear();
      warn.mockClear();
      const text =
        'PRIVATECANARY I built robust AI-first TypeScript v5.6 services — using --name="two  spaces".\n\nhttps://example.test/v1?q=a--b';
      const before = text;
      const result = inspectGroundedText(text, platform);
      expect(result.fingerprintPatterns.length).toBeGreaterThan(0);
      expect(text).toBe(before);
      const logs = JSON.stringify([info.mock.calls, warn.mock.calls]);
      expect(logs).not.toContain("PRIVATECANARY");
      expect(logs).not.toContain("example.test");
    },
  );
  it("preserves email-specific contact policy and harmless literal technical markup", () => {
    expect(() =>
      inspectGroundedText("Contact test@example.test", "email"),
    ).not.toThrow();
    expect(() =>
      inspectGroundedText("I used Array<T>.", "general"),
    ).not.toThrow();
  });
});
