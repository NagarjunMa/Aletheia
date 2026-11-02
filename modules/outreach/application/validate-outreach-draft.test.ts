import { describe, expect, it } from "vitest";
import { proseFixture } from "@/__tests__/helpers/prose-fixture";
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

describe("atomic proof references", () => {
  it("accepts current selected candidate fact IDs without modifying sources or ledger", () => {
    const { context, coldDraft } = proseFixture(
      "cold_email",
      "initial_outreach",
    );
    const before = JSON.stringify({ context, coldDraft });
    expect(
      validateOutreachDraft({
        draft: coldDraft,
        sources: context.sources,
        atomicSources: context.atomicSources,
      }),
    ).toBe(coldDraft);
    expect(JSON.stringify({ context, coldDraft })).toBe(before);
  });
  it.each([
    "unknown",
    "target",
    "unselected_root",
    "atomic_root",
    "similar_id",
    "unsupported_text",
  ])("rejects %s references", (kind) => {
    const { context, coldDraft } = proseFixture(
      "cold_email",
      "initial_outreach",
    );
    const atomic = context.atomicSources!.find(
      (s) => s.scope === "candidate" && s.kind === "outcome",
    )!;
    let id = atomic.id;
    if (kind === "unknown") id = "unknown";
    if (kind === "target")
      id = context.atomicSources!.find((s) => s.scope === "target")!.id;
    if (kind === "unselected_root") atomic.rootId = "unselected";
    if (kind === "atomic_root")
      atomic.rootId = context.atomicSources!.find(
        (s) => s.scope === "candidate" && s.kind === "action",
      )!.id;
    if (kind === "similar_id") id += ".unselected";
    if (kind === "unsupported_text")
      coldDraft.proof_points[0]!.text = "Managed global retail sales.";
    coldDraft.proof_points[0]!.source_ids = [id];
    expect(() =>
      validateOutreachDraft({
        draft: coldDraft,
        sources: context.sources,
        atomicSources: context.atomicSources,
      }),
    ).toThrow(OutreachDraftValidationError);
  });
});
