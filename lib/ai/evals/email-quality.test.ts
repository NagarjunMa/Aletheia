import { describe, expect, it } from "vitest";
import type { CandidateGroundingSource } from "@/modules/candidate-context/domain/candidate-context.types";
import type { ColdEmailDraft } from "@/modules/outreach/domain/outreach-draft.types";
import {
  OutreachDraftValidationError,
  validateOutreachDraft,
} from "@/modules/outreach/application/validate-outreach-draft";

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
      context: goldenCase.qualityContext,
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
      context: goldenCase.qualityContext,
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

  it("captures every observed Nordnet failure mode", () => {
    const goldenCase = cases.find(
      (candidate) => candidate.id === "nordnet-engineering-productivity-001",
    );

    expect(goldenCase).toBeDefined();
    if (!goldenCase) {
      throw new Error("Missing Nordnet engineering productivity golden case.");
    }

    const result = evaluateEmailQuality(goldenCase.generated, {
      mode: goldenCase.emailMode,
      rules: goldenCase.expectedRules,
      context: goldenCase.qualityContext,
    });

    expect(violationRules(result)).toEqual(
      expect.arrayContaining([
        "has_concrete_ai_workflow_evidence",
        "no_generic_ai_language",
        "exploring_requires_confirmed_source",
        "no_technology_inventory",
        "no_orphan_technology_line",
        "no_duplicate_candidate_claim",
        "has_complete_or_omitted_signature",
      ]),
    );
    expect(goldenCase.grounding?.selectedSources).toHaveLength(2);
    for (const source of goldenCase.grounding?.selectedSources ?? []) {
      expect(goldenCase.preferred).toContain(source.requiredPhrase);
    }

    const sources: CandidateGroundingSource[] =
      goldenCase.grounding?.selectedSources.map((source) => ({
        id: source.id,
        type: source.kind,
        label: source.label,
        content: source.content,
        priority: source.priority,
      })) ?? [];
    const draft: ColdEmailDraft = {
      subject_line: "Reliable AI-assisted developer workflows",
      greeting: "Morgan",
      target_opening:
        "Your Engineering Productivity team’s focus on reliable AI-assisted development caught my attention.",
      candidate_positioning:
        "I build backend systems that help engineering teams ship safely.",
      proof_points: sources.map((source) => ({
        text: source.content,
        source_ids: [source.id],
      })),
      value_statement:
        "That experience maps well to a team making AI assistance dependable for developers.",
      cta: "Would you be open to a brief chat about the problems your team is prioritizing?",
    };

    expect(validateOutreachDraft({ draft, sources })).toEqual(draft);
    expect(() =>
      validateOutreachDraft({
        draft: {
          ...draft,
          proof_points: [
            { ...draft.proof_points[0]!, source_ids: ["evidence:unknown"] },
          ],
        },
        sources,
      }),
    ).toThrow(OutreachDraftValidationError);
  });

  it("permits exploratory wording only when selected evidence supports it", () => {
    const body =
      "Hi Morgan,\n\nI am exploring AI-assisted developer workflows.\n\nBest,\nAvery Morgan";

    expect(
      evaluateEmailQuality(body, {
        mode: "follow_up",
        rules: ["exploring_requires_confirmed_source"],
      }).passed,
    ).toBe(false);
    expect(
      evaluateEmailQuality(body, {
        mode: "follow_up",
        rules: ["exploring_requires_confirmed_source"],
        context: { allowsExploring: true },
      }).passed,
    ).toBe(true);
  });

  it("rejects inline signatures instead of treating them as omitted", () => {
    const result = evaluateEmailQuality(
      "Hi Morgan,\n\nA concise note.\n\nBest, Avery Morgan",
      {
        mode: "follow_up",
        rules: ["has_complete_or_omitted_signature"],
      },
    );

    expect(violationRules(result)).toContain(
      "has_complete_or_omitted_signature",
    );
  });
});
