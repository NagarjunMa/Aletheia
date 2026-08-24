import { describe, expect, it } from "vitest";
import type { CandidateGroundingSource } from "@/modules/candidate-context/domain/candidate-context.types";
import type { ColdEmailDraft } from "../domain/outreach-draft.types";
import {
  OutreachDraftValidationError,
  validateOutreachDraft,
} from "./validate-outreach-draft";

const sources: CandidateGroundingSource[] = [
  {
    id: "evidence:ai-workflow",
    type: "evidence",
    label: "AI workflow",
    content:
      "Built an LLM-assisted developer review workflow using TypeScript.",
    priority: 1,
  },
];
const draft: ColdEmailDraft = {
  subject_line: "AI engineering interest",
  greeting: "Megan",
  target_opening: "Your developer-productivity work stood out.",
  candidate_positioning: "I build production software for engineers.",
  proof_points: [
    {
      text: "Built an LLM-assisted review workflow in TypeScript.",
      source_ids: ["evidence:ai-workflow"],
    },
  ],
  value_statement: "That background fits a practical AI product team.",
  cta: "Would you be open to a brief chat?",
};

describe("validateOutreachDraft", () => {
  it("accepts selected source references with supporting overlap", () => {
    expect(validateOutreachDraft({ draft, sources })).toEqual(draft);
  });

  it("fails closed for unknown source IDs and unsupported proof claims", () => {
    expect(() =>
      validateOutreachDraft({
        draft: {
          ...draft,
          proof_points: [
            { ...draft.proof_points[0]!, source_ids: ["resume:unknown"] },
          ],
        },
        sources,
      }),
    ).toThrow(OutreachDraftValidationError);
    expect(() =>
      validateOutreachDraft({
        draft: {
          ...draft,
          proof_points: [
            {
              ...draft.proof_points[0]!,
              text: "Managed a global sales team.",
              source_ids: ["evidence:ai-workflow"],
            },
          ],
        },
        sources,
      }),
    ).toThrow(OutreachDraftValidationError);
  });
});
