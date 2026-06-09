import { describe, expect, it } from "vitest";

import goldenCases from "./email-golden-cases.json";
import {
  countEmailWords,
  evaluateEmailQuality,
  splitEmailParagraphs,
  type GoldenEmailCase,
} from "./email-quality";

const cases = goldenCases as GoldenEmailCase[];

function violationRules(result: ReturnType<typeof evaluateEmailQuality>) {
  return result.violations.map((violation) => violation.rule);
}

describe("email quality evals", () => {
  it.each(cases)("passes the preferred golden output for $id", (goldenCase) => {
    const result = evaluateEmailQuality(goldenCase.preferred, {
      mode: goldenCase.emailMode,
      rules: goldenCase.expectedRules,
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.violations).toEqual([]);
  });

  it.each(cases)(
    "flags the original generated output for $id",
    (goldenCase) => {
      const result = evaluateEmailQuality(goldenCase.generated, {
        mode: goldenCase.emailMode,
        rules: goldenCase.expectedRules,
      });

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    },
  );

  it("captures the wall-of-text and signature issues in initial outreach", () => {
    const goldenCase = cases.find(
      (candidate) => candidate.id === "yc-ceo-bountiful-initial-outreach-001",
    );

    expect(goldenCase).toBeDefined();
    if (!goldenCase) {
      throw new Error("Missing Bountiful initial outreach golden case.");
    }

    const result = evaluateEmailQuality(goldenCase.generated, {
      mode: goldenCase.emailMode,
      rules: goldenCase.expectedRules,
    });

    expect(violationRules(result)).toEqual(
      expect.arrayContaining([
        "has_greeting_blank_line",
        "has_2_to_5_paragraphs",
        "not_wall_of_text",
        "limited_hyphen_connectors",
        "cta_is_capitalized",
        "signature_on_own_line",
      ]),
    );
  });

  it("captures over-expanded role-fit clarification formatting", () => {
    const goldenCase = cases.find(
      (candidate) => candidate.id === "startup-role-fit-clarification-001",
    );

    expect(goldenCase).toBeDefined();
    if (!goldenCase) {
      throw new Error("Missing startup role-fit clarification golden case.");
    }

    const result = evaluateEmailQuality(goldenCase.generated, {
      mode: goldenCase.emailMode,
      rules: goldenCase.expectedRules,
    });

    expect(violationRules(result)).toEqual(
      expect.arrayContaining(["has_greeting_blank_line", "not_wall_of_text"]),
    );
  });

  it("splits email paragraphs on blank lines only", () => {
    expect(
      splitEmailParagraphs(
        "Hi Rob,\n\nBody line one.\nBody line two.\n\nBest,\nNagarjun",
      ),
    ).toEqual(["Hi Rob,", "Body line one.\nBody line two.", "Best,\nNagarjun"]);
  });

  it("does not count URLs as prose words", () => {
    expect(
      countEmailWords("Thanks,\nNagarjun\nlinkedin.com/in/nagarjun-mallesh"),
    ).toBe(2);
  });
});
