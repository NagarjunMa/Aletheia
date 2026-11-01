import { describe, expect, it } from "vitest";
import { firstLinkedinOption } from "@/__tests__/helpers/linkedin-option";
import {
  resolveLinkedinSelection,
  buildLinkedinSelectionTool,
  linkedinCandidateFits,
} from "../domain/linkedin-grounded-selection";
import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import { renderLinkedinConnection } from "./render-linkedin-connection";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";
const target: AtomicSource = {
  id: "target.profile.0",
  scope: "target",
  kind: "target_observation",
  content: "Engineering Manager at Example | AI Evaluation",
  rewrite: "linkedin_profile_interest",
};
const candidate: AtomicSource = {
  id: "evidence:one.fact.action",
  rootId: "evidence:one",
  scope: "candidate",
  kind: "action",
  content: "I built an AI evaluation agent.",
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

  it("resolves every offered option into a supported complete message", () => {
    for (const option_id of buildLinkedinSelectionTool(sources).input_schema
      .properties.option_id.enum) {
      const draft = resolveLinkedinSelection({ option_id }, sources, roots);
      const rendered = renderLinkedinConnection({ draft, sources: roots });
      expect(rendered.body).toContain(candidate.content);
      expect(rendered.body.length).toBeLessThanOrEqual(300);
      expect(() =>
        validateAtomicOutput({
          claims: draft.claims,
          sources,
          excludedClaims: [],
          fields: [
            { text: rendered.body, scope: "either" },
            { text: draft.target_observation, scope: "target" },
            { text: draft.candidate_relevance!.text, scope: "candidate" },
            { text: draft.cta, scope: "either" },
          ],
        }),
      ).not.toThrow();
    }
  });
  it("supports target-only options only when no reviewed relevant fact is available", () => {
    const draft = resolveLinkedinSelection(
      firstLinkedinOption([target]),
      [target],
      [],
    );
    expect(draft.candidate_relevance).toBeNull();
    expect(draft.claims).toHaveLength(1);
  });
  it("rejects stale options after a source or intent changes", () => {
    const choice = firstLinkedinOption(sources);
    expect(() =>
      resolveLinkedinSelection(
        choice,
        [
          target,
          { ...candidate, content: candidate.content + " I tested it." },
        ],
        roots,
      ),
    ).toThrow();
    expect(() =>
      resolveLinkedinSelection(choice, sources, roots, "mentorship"),
    ).toThrow();
  });
  it.each([
    { option_id: "unknown" },
    { option_id: "a".repeat(81) },
    { option_id: null },
    { option_id: "unknown", claims: [] },
  ])("rejects forged or oversized selections %#", (input) =>
    expect(() => resolveLinkedinSelection(input, sources, roots)).toThrow(),
  );
  it("rejects missing candidate roots", () =>
    expect(() =>
      resolveLinkedinSelection(firstLinkedinOption(sources), sources, []),
    ).toThrow());
  it("retains an intact 300-character composition, never offering 301", () => {
    const base = resolveLinkedinSelection(
      firstLinkedinOption(sources),
      sources,
      roots,
    );
    const size = renderLinkedinConnection({ draft: base, sources: roots }).body
      .length;
    const content = candidate.content + "x".repeat(300 - size);
    const boundary = { ...candidate, content };
    const updatedRoots = [{ ...roots[0]!, content }];
    const draft = resolveLinkedinSelection(
      firstLinkedinOption([target, boundary]),
      [target, boundary],
      updatedRoots,
    );
    expect(
      renderLinkedinConnection({ draft, sources: updatedRoots }).body,
    ).toHaveLength(300);
    expect(linkedinCandidateFits(boundary, [target])).toBe(true);
    expect(
      linkedinCandidateFits({ ...boundary, content: content + "x" }, [target]),
    ).toBe(false);
    const over = [target, { ...boundary, content: content + "x" }];
    expect(
      resolveLinkedinSelection(firstLinkedinOption(over), over, updatedRoots)
        .candidate_relevance,
    ).toBeNull();
  });
  it("rejects no target or quotation-only targets before the provider call", () => {
    expect(() => buildLinkedinSelectionTool([])).toThrow();
    expect(() =>
      buildLinkedinSelectionTool([
        {
          ...target,
          content: "Engineering Manager at Example | Retired since 2020",
        },
      ]),
    ).toThrow(
      expect.objectContaining({
        reasonCodes: expect.arrayContaining(["TARGET_WORDING_UNSUPPORTED"]),
      }),
    );
  });
  it("offers only bounded opaque IDs and escaped option previews", () => {
    const tool = buildLinkedinSelectionTool(sources);
    expect(Object.keys(tool.input_schema.properties)).toEqual(["option_id"]);
    expect(
      tool.input_schema.properties.option_id.enum.length,
    ).toBeLessThanOrEqual(8);
    expect(tool.input_schema.additionalProperties).toBe(false);
    expect(tool.description).not.toContain(candidate.id);
    expect(tool.description).toContain("<user_input>");
  });
});
