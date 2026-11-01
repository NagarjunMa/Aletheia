import { describe, expect, it } from "vitest";

import goldenCases from "./linkedin-connection-golden-cases.json";
import {
  evaluateLinkedInConnectionQuality,
  type GoldenLinkedInConnectionCase,
} from "./linkedin-connection-quality";

const cases = goldenCases as GoldenLinkedInConnectionCase[];

describe("LinkedIn connection quality evals", () => {
  it("accepts a neutral greeting and a whole courtesy after an intact invitation", () => {
    expect(
      evaluateLinkedInConnectionQuality(
        "Hi there, I built evaluation tooling. Your role interests me. Open to connecting? Thank you.",
        ["has_greeting", "has_polished_ask", "has_final_cta"],
      ).passed,
    ).toBe(true);
    expect(
      evaluateLinkedInConnectionQuality(
        "Hi there, I built evaluation tooling. Open to a brief Thank you.",
        ["has_final_cta"],
      ).passed,
    ).toBe(false);
  });
  it.each(cases)("passes preferred output for $id", (goldenCase) => {
    const result = evaluateLinkedInConnectionQuality(
      goldenCase.preferred,
      goldenCase.expectedRules,
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it.each(cases)("flags generated output for $id", (goldenCase) => {
    const result = evaluateLinkedInConnectionQuality(
      goldenCase.generated,
      goldenCase.expectedRules,
    );

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("flags a note whose CTA is cut off before the final section", () => {
    const result = evaluateLinkedInConnectionQuality(
      "Your developer tooling work stood out. I built an LLM review workflow. Open to a brief",
      ["has_final_cta"],
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({ rule: "has_final_cta" }),
    ]);
  });
});
