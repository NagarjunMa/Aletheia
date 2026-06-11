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

  it("preserves period-sensitive technical tokens and URLs", () => {
    const body =
      "Hi Eric,\n\nI have built Next.js APIs and Node.js services for production systems.\n\nBest,\nNagarjun Mallesh\nlinkedin.com/in/nagarjun-mallesh\ngithub.com/NagarjunMa";

    const formatted = formatGeneratedEmailBody(body, {
      category: "cold_email",
      mode: "founder_ceo_outreach",
    });

    expect(formatted).toContain("Next.js APIs");
    expect(formatted).toContain("Node.js services");
    expect(formatted).toContain("Best,\nNagarjun Mallesh");
    expect(formatted).toContain("linkedin.com/in/nagarjun-mallesh");
    expect(formatted).toContain("github.com/NagarjunMa");
    expect(formatted).not.toMatch(/(^|\n\n|\.\s+)js APIs/i);
    expect(formatted).not.toMatch(/(^|\n\n|\.\s+)com\/in/i);
  });

  it("preserves structured proof-point lines", () => {
    const body =
      "Hi Eric,\n\nA quick look at my background:\nCloud & Infrastructure: Built Terraform-managed AWS environments.\nAutomation: Reduced setup work from days to minutes.\nFull-Stack Context: Worked across Python and TypeScript.\n\nLet me know if you are open to a brief chat.\n\nBest,\nNagarjun Mallesh\nlinkedin.com/in/nagarjun-mallesh";

    const formatted = formatGeneratedEmailBody(body, {
      category: "cold_email",
      mode: "founder_ceo_outreach",
    });

    expect(formatted).toContain(
      "A quick look at my background:\nCloud & Infrastructure:",
    );
    expect(formatted).toContain("\nAutomation:");
    expect(formatted).toContain("\nFull-Stack Context:");
  });

  it("uses stricter word limits for concise email modes", () => {
    const expectations: Array<[EmailMode, number]> = [
      ["initial_outreach", 150],
      ["founder_ceo_outreach", 190],
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
