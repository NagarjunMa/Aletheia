import { it, expect } from "vitest";
import {
  buildLinkedinCompositions,
  buildLinkedinSelectionTool,
  resolveLinkedinSelection,
} from "./linkedin-grounded-selection";
import { renderLinkedinConnection } from "../application/render-linkedin-connection";
import { finalizeGroundedOutput } from "@/modules/grounding/application/finalize-grounded-output";
import { resolveOutputConstraint } from "@/lib/ai/output-constraints";
import { planSelection } from "@/modules/grounding/domain/rhetorical-plan";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";
const sources: AtomicSource[] = [
  {
    id: "target.profile.0",
    scope: "target",
    kind: "target_observation",
    content: "Engineering Manager at Example | AI Evaluation",
    rewrite: "linkedin_profile_interest",
  },
  {
    id: "candidate.1",
    rootId: "root",
    scope: "candidate",
    kind: "action",
    content: "I built evaluation tools without production deployment.",
  },
];
const roots = [
  {
    id: "root",
    type: "evidence" as const,
    label: "Reviewed",
    priority: 1 as const,
    content: sources[1]!.content,
  },
];
it.each(["networking", "job_inquiry", "mentorship", "referral"] as const)(
  "preserves a complete introduction and CTA for enabled %s",
  (intent) => {
    const off = buildLinkedinCompositions(sources, intent);
    expect(buildLinkedinCompositions(sources, intent, false)).toEqual(off);
    const options = buildLinkedinCompositions(sources, intent, true);
    for (const o of options) {
      const draft = resolveLinkedinSelection(
        { option_id: o.id, rhetorical_plan: planSelection(o.rhetoricalPlan!) },
        sources,
        roots,
        intent,
        true,
      );
      const rendered = renderLinkedinConnection({ draft, sources: roots });
      expect(rendered.body).toBe(o.body);
      expect(rendered.body.startsWith("Hi there,")).toBe(true);
      expect(rendered.body.endsWith(draft.cta)).toBe(true);
      expect(rendered.body).toContain(sources[1]!.content);
      expect(() =>
        finalizeGroundedOutput({
          body: rendered.body,
          platform: "linkedin",
          claims: draft.claims!,
          sources,
          excludedClaims: [],
          bodyConstraint: resolveOutputConstraint({
            category: "linkedin_connection",
          }),
          requiredEnding: draft.cta,
        }),
      ).not.toThrow();
      expect(() =>
        resolveLinkedinSelection(
          { option_id: o.id },
          sources,
          roots,
          intent,
          true,
        ),
      ).toThrow();
      expect(() =>
        resolveLinkedinSelection(
          {
            option_id: o.id,
            rhetorical_plan: {
              ...planSelection(o.rhetoricalPlan!),
              explanation: "private",
            },
          },
          sources,
          roots,
          intent,
          true,
        ),
      ).toThrow();
    }
    expect(
      buildLinkedinSelectionTool(sources, undefined, intent, true).input_schema
        .required,
    ).toEqual(["option_id", "rhetorical_plan"]);
  },
);
it("has an explicit target-only fallback, no source-less plan and no stale source selection", () => {
  const options = buildLinkedinCompositions(
    sources.slice(0, 1),
    "networking",
    true,
  );
  expect(
    options.every((o) => o.rhetoricalPlan?.archetype === "target_only"),
  ).toBe(true);
  expect(() =>
    buildLinkedinSelectionTool([], undefined, "networking", true),
  ).toThrow();
  const o = options[0]!;
  expect(() =>
    resolveLinkedinSelection(
      { option_id: o.id, rhetorical_plan: planSelection(o.rhetoricalPlan!) },
      sources,
      roots,
      "networking",
      true,
    ),
  ).toThrow();
});
