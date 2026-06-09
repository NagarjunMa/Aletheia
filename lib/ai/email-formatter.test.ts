import { describe, expect, it } from "vitest";

import goldenCases from "@/lib/ai/evals/email-golden-cases.json";
import {
  formatGeneratedEmailBody,
  getEmailWordLimit,
  type EmailMode,
} from "./email-formatter";
import {
  evaluateEmailQuality,
  type GoldenEmailCase,
} from "./evals/email-quality";

const cases = goldenCases as GoldenEmailCase[];

describe("formatGeneratedEmailBody", () => {
  it("formats dense initial outreach into readable paragraphs", () => {
    const goldenCase = cases.find(
      (candidate) => candidate.id === "yc-ceo-bountiful-initial-outreach-001",
    );
    if (!goldenCase) {
      throw new Error("Missing Bountiful initial outreach golden case.");
    }

    const formatted = formatGeneratedEmailBody(goldenCase.generated, {
      category: goldenCase.category,
      mode: goldenCase.emailMode,
    });
    const result = evaluateEmailQuality(formatted, {
      mode: goldenCase.emailMode,
      rules: goldenCase.expectedRules,
    });

    expect(formatted).toContain("Hi Megan,\n\n");
    expect(formatted).toContain("\n\nOn the technical side,");
    expect(formatted).toContain("\n\nInterested in a quick chat");
    expect(formatted).toContain("Thanks either way,\nNagarjun");
    expect(result.passed).toBe(true);
  });

  it("adds missing greeting spacing in role-fit summaries without expanding text", () => {
    const body =
      "Hi Rob,\nHaving said that, working in a startup has given me experience across all touchpoints. Please advise me on available roles.\n\nBest,\nNagarjun Mallesh";

    expect(
      formatGeneratedEmailBody(body, {
        category: "cold_email",
        mode: "role_fit_summary",
      }),
    ).toBe(
      "Hi Rob,\n\nHaving said that, working in a startup has given me experience across all touchpoints.\n\nPlease advise me on available roles.\n\nBest,\nNagarjun Mallesh",
    );
  });

  it("uses stricter word limits for concise email modes", () => {
    const expectations: Array<[EmailMode, number]> = [
      ["initial_outreach", 150],
      ["role_fit_summary", 110],
      ["clarification", 90],
      ["follow_up", 90],
      ["referral_request", 130],
    ];

    for (const [mode, max] of expectations) {
      expect(getEmailWordLimit("cold_email", mode).max).toBe(max);
    }
  });
});
