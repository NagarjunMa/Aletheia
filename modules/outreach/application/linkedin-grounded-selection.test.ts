import { describe, expect, it } from "vitest";
import {
  resolveLinkedinSelection,
  buildLinkedinSelectionTool,
} from "../domain/linkedin-grounded-selection";
import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import { renderLinkedinConnection } from "./render-linkedin-connection";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";

const target: AtomicSource = {
  id: "target.profile.0",
  scope: "target",
  kind: "target_observation",
  content: "Builds evaluation tooling for policy-grounded AI agents.",
};
const candidate: AtomicSource = {
  id: "evidence:one.fact.action",
  rootId: "evidence:one",
  scope: "candidate",
  kind: "action",
  content: "I built a policy-grounded evaluation agent.",
};
const sources = [target, candidate];
const roots = [
  {
    id: "evidence:one",
    type: "evidence" as const,
    label: "Project",
    priority: 1 as const,
    content: candidate.content,
  },
];
const selection = {
  target_source_id: target.id,
  candidate_source_id: candidate.id,
  cta: "Open to a brief chat?",
};

describe("server-owned LinkedIn factual composition", () => {
  it("reproduces CLAIM_REWRITE for unsupported wording instead of relaxing the validator", () => {
    expect(() =>
      validateAtomicOutput({
        claims: [
          {
            text: "You build policy-grounded agents.",
            kind: target.kind,
            source_id: target.id,
            supporting_excerpt: target.content,
          },
        ],
        sources: [target],
        excludedClaims: [],
        fields: [
          { text: "You build policy-grounded agents.", scope: "target" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "CLAIM_REWRITE" }));
  });

  it("resolves IDs into exact supported text and ledger accepted by unchanged validators", () => {
    const draft = resolveLinkedinSelection(selection, sources, roots);
    const rendered = renderLinkedinConnection({ draft, sources: roots });
    expect(rendered.body).toContain(candidate.content);
    expect(rendered.body.length).toBeLessThanOrEqual(300);
    expect(() =>
      validateAtomicOutput({
        claims: draft.claims,
        sources,
        excludedClaims: [],
        fields: [
          { text: draft.target_observation, scope: "target" },
          { text: draft.candidate_relevance!.text, scope: "candidate" },
          { text: draft.cta, scope: "either" },
        ],
      }),
    ).not.toThrow();
  });
  it("supports target-only selection without inventing candidate relevance", () => {
    const draft = resolveLinkedinSelection(
      { ...selection, candidate_source_id: null },
      [target],
      [],
    );
    expect(draft.candidate_relevance).toBeNull();
    expect(draft.claims).toHaveLength(1);
  });
  it.each([
    { ...selection, target_source_id: "unknown" },
    { ...selection, target_source_id: candidate.id },
    { ...selection, candidate_source_id: target.id },
    { ...selection, cta: "Your company increased revenue by 40%." },
    { ...selection, claims: [] },
    { ...selection, target_observation: "Unsupported free text" },
  ])("rejects untrusted selections %#", (input) =>
    expect(() => resolveLinkedinSelection(input, sources, roots)).toThrow(),
  );
  it("rejects missing candidate roots and oversized complete compositions", () => {
    expect(() => resolveLinkedinSelection(selection, sources, [])).toThrow();
    expect(() =>
      renderLinkedinConnection({
        draft: resolveLinkedinSelection(
          selection,
          [{ ...target, content: "x".repeat(240) }, candidate],
          roots,
        ),
        sources: roots,
      }),
    ).toThrow();
  });
  it("rejects an empty target pool before a provider call", () =>
    expect(() => buildLinkedinSelectionTool([])).toThrow());
  it("offers only request-owned IDs and existing approved CTA phrases", () => {
    const tool = buildLinkedinSelectionTool(sources);
    expect(tool.input_schema.properties.target_source_id.enum).toEqual([
      target.id,
    ]);
    expect(
      tool.input_schema.properties.candidate_source_id.anyOf?.[0]?.enum,
    ).toEqual([candidate.id]);
    expect(tool.input_schema.additionalProperties).toBe(false);
    expect(tool.input_schema.properties).not.toHaveProperty("claims");
  });
});
