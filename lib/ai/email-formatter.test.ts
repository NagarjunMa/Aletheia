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

  it("repairs inline initial outreach proof points into a scannable block", () => {
    const body =
      "Hi Erica, Saw your post about the Support AI Engineer opening on your team, building AI-powered infrastructure and workflows to scale support is exactly the kind of work I've been focused on. That maps closely to my background, and I'd love to be on your radar for this role. A quick look at my background: AI & Backend Systems: Python and FastAPI building backend services and AI/RAG pipelines Cloud & Infrastructure: AWS environments managed with Terraform across backend and automation workflows Full-Stack Context: TypeScript, React, and Node.js alongside core backend and cloud work I think my background fits well given the emphasis on turning ambiguous operational problems into scalable technical solutions, that's where I do my best work.\n\nBest,\nNagarjun Mallesh\nlinkedin.com/in/nagarjun-mallesh";

    const formatted = formatGeneratedEmailBody(body, {
      category: "cold_email",
      mode: "initial_outreach",
    });

    expect(formatted).toContain("Hi Erica,\n\n");
    expect(formatted).toContain(
      "A quick look at my background:\nAI & Backend Systems:",
    );
    expect(formatted).toContain("\nCloud & Infrastructure:");
    expect(formatted).toContain("\nFull-Stack Context:");
    expect(formatted).toContain(
      "\n\nI think my background fits well given the emphasis",
    );
    expect(formatted).toContain("Best,\nNagarjun Mallesh");
    expect(formatted).toContain("linkedin.com/in/nagarjun-mallesh");
  });

  it("keeps FastAPI attached when repairing inline founder proof labels", () => {
    const body =
      "Hi Talha,\n\nYour post about founding.dev caught my attention, replacing bloated SaaS stacks with custom-built tooling is a real problem worth solving. That's the kind of infrastructure and product challenge I want to work on.\n\nA quick look at my background:\nCloud & Infrastructure: AWS environments managed with Terraform across backend services AI & RAG Systems: Built RAG pipelines and AI-integrated backend services using Python and FastAPI Full-Stack Context: TypeScript, React, and Node.js alongside core backend and cloud work I think my background maps well to what you're building, the infra automation and AI integration layers especially. I'd be interested in learning more about what you're building and where I could contribute. Would you be open to a brief conversation?\n\nBest,\nNagarjun Mallesh\nlinkedin.com/in/nagarjun-mallesh";

    const formatted = formatGeneratedEmailBody(body, {
      category: "cold_email",
      mode: "founder_ceo_outreach",
    });

    expect(formatted).toContain(
      "AI & RAG Systems: Built RAG pipelines and AI-integrated backend services using Python and FastAPI",
    );
    expect(formatted).toContain(
      "\nFull-Stack Context: TypeScript, React, and Node.js alongside core backend and cloud work",
    );
    expect(formatted).not.toMatch(/\n\nFastAPI\b/);
    expect(formatted).toContain(
      "\n\nI'd be interested in learning more about what you're building and where I could contribute.",
    );
    expect(formatted).toContain("Would you be open to a brief conversation?");
  });

  it("removes misleading resume attachment status while preserving the ask", () => {
    const body =
      "Hi Dhiraj,\n\nI came across your post about AI Engineer openings. I don't have a resume attached here, but I'd genuinely like to learn more about what you're building and where I might fit.\n\nBest,\nNagarjun Mallesh";

    const formatted = formatGeneratedEmailBody(body, {
      category: "cold_email",
      mode: "initial_outreach",
    });

    expect(formatted).toContain("I'd genuinely like to learn more");
    expect(formatted).not.toMatch(/resume|cv/i);
    expect(formatted).not.toMatch(/attached/i);
  });

  it("removes positive resume attachment claims because the app drafts copy only", () => {
    const body =
      "Hi Maya,\n\nPlease find my resume attached. I noticed your platform engineering work and would be glad to share more context.\n\nBest,\nNagarjun Mallesh";

    const formatted = formatGeneratedEmailBody(body, {
      category: "cold_email",
      mode: "initial_outreach",
    });

    expect(formatted).toContain("I noticed your platform engineering work");
    expect(formatted).not.toMatch(/resume|cv/i);
    expect(formatted).not.toMatch(/attached/i);
  });

  it("uses stricter word limits for concise email modes", () => {
    const expectations: Array<[EmailMode, number]> = [
      ["initial_outreach", 185],
      ["founder_ceo_outreach", 155],
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
