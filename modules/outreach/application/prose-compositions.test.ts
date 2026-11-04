import { it, expect, vi } from "vitest";
import { EMAIL_MODES } from "@/lib/ai/email-formatter";
import * as provenance from "./validate-outreach-provenance";
import { proseFixture } from "@/__tests__/helpers/prose-fixture";
import {
  buildProseCompositions,
  buildProseSelectionTool,
  resolveProseSelection,
  ProseGroundingUnavailableError,
} from "./prose-compositions";
import { validateOutreachProvenance } from "./validate-outreach-provenance";
import { resolveOutputConstraint } from "@/lib/ai/output-constraints";

it.each(
  (["cold_email", "linkedin_inmail"] as const).flatMap((category) =>
    EMAIL_MODES.map((emailMode) => [category, emailMode] as const),
  ),
)(
  "offers only exact, final-valid %s/%s compositions",
  (category, emailMode) => {
    const { context, action } = proseFixture(category, emailMode);
    const before = JSON.stringify(context);
    const options = buildProseCompositions({ category, emailMode, context });
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(8);
    expect(
      Buffer.byteLength(
        JSON.stringify(
          options.map(({ id, body, subject }) => ({ id, body, subject })),
        ),
      ),
    ).toBeLessThanOrEqual(12000);
    for (const option of options) {
      expect(() =>
        validateOutreachProvenance({
          body: option.body,
          subject: option.subject,
          claims: option.claims,
          context,
          bodyConstraint: resolveOutputConstraint({ category, emailMode }),
          renderedSignature: category === "cold_email",
          platform: category === "cold_email" ? "email" : "linkedin",
        }),
      ).not.toThrow();
      expect(
        option.claims.some((c) => c.source_id.startsWith("evidence:")),
      ).toBe(true);
      expect(
        option.body.includes(action) ||
          option.body.includes(
            context.atomicSources!.find((s) => s.kind === "outcome")!.content,
          ),
      ).toBe(true);
      expect(resolveProseSelection({ option_id: option.id }, options)).toBe(
        option,
      );
    }
    expect(JSON.stringify(context)).toBe(before);
    const tool = buildProseSelectionTool(category, options);
    expect(Object.keys(tool.input_schema.properties)).toEqual(["option_id"]);
    for (const input of [
      { option_id: "stale" },
      { option_id: options[0]!.id, body: "UNSUPPORTED" },
      { body: action },
    ])
      expect(() => resolveProseSelection(input, options)).toThrow();
  },
);
it("binds options to current source review, identity and mode", () => {
  const { context } = proseFixture("cold_email", "initial_outreach");
  const options = buildProseCompositions({
    category: "cold_email",
    emailMode: "initial_outreach",
    context,
  });
  const changed = structuredClone(context);
  changed.identity.fullName = "Different";
  expect(() =>
    resolveProseSelection(
      { option_id: options[0]!.id },
      buildProseCompositions({
        category: "cold_email",
        emailMode: "initial_outreach",
        context: changed,
      }),
    ),
  ).toThrow();
  expect(() =>
    resolveProseSelection(
      { option_id: options[0]!.id },
      buildProseCompositions({
        category: "cold_email",
        emailMode: "follow_up",
        context,
      }),
    ),
  ).toThrow();
});
it("rejects insufficient/withdrawn evidence rather than repeating or shortening a fact", () => {
  const { context } = proseFixture("cold_email", "initial_outreach");
  context.atomicSources = [];
  expect(() =>
    buildProseCompositions({
      category: "cold_email",
      emailMode: "initial_outreach",
      context,
    }),
  ).toThrow(ProseGroundingUnavailableError);
});
it("retains complete literal technical whitespace and negative qualifications", () => {
  const { context } = proseFixture("cold_email", "follow_up");
  const fact = context.atomicSources!.find((s) => s.scope === "candidate")!;
  fact.content = fact.content.replace(
    "policy evaluation",
    'policy evaluation using --name="two  spaces"',
  );
  context.sources[0]!.content += `\n${fact.content}`;
  const options = buildProseCompositions({
    category: "cold_email",
    emailMode: "follow_up",
    context,
  });
  for (const o of options)
    if (o.body.includes("--name=")) {
      expect(o.body).toContain('--name="two  spaces"');
      expect(o.body).toContain("without deploying");
    }
  expect(options.some((o) => o.body.includes("--name="))).toBe(true);
});

it("bounds final-validation work when every otherwise fitting combination is excluded", () => {
  const { context } = proseFixture("cold_email", "initial_outreach");
  const candidate = context.atomicSources!.find((s) => s.kind === "action")!;
  const target = context.atomicSources!.find((s) => s.scope === "target")!;
  context.atomicSources = [
    ...Array.from({ length: 48 }, (_, i) => ({
      ...candidate,
      id: `candidate-${i}`,
      content: candidate.content.replace("prototype", `prototype${i}`),
    })),
    ...Array.from({ length: 16 }, (_, i) => ({ ...target, id: `target-${i}` })),
  ];
  context.excludedClaims = ["prototype"];
  const check = vi.spyOn(provenance, "validateOutreachProvenance");
  try {
    expect(() =>
      buildProseCompositions({
        category: "cold_email",
        emailMode: "initial_outreach",
        context,
      }),
    ).toThrow(ProseGroundingUnavailableError);
    expect(check.mock.calls.length).toBeGreaterThan(0);
    expect(check.mock.calls.length).toBeLessThanOrEqual(256);
  } finally {
    check.mockRestore();
  }
});

it.each(["cold_email", "linkedin_inmail"] as const)(
  "binds enabled %s plans without weakening final provenance",
  (category) => {
    const { context } = proseFixture(category, "initial_outreach");
    const input = { category, emailMode: "initial_outreach" as const, context };
    expect(
      buildProseCompositions({ ...input, rhetoricalPlans: false }),
    ).toEqual(buildProseCompositions(input));
    const options = buildProseCompositions({ ...input, rhetoricalPlans: true });
    expect(options).toEqual(
      buildProseCompositions({ ...input, rhetoricalPlans: true }),
    );
    for (const option of options) {
      const p = option.rhetoricalPlan!;
      const selection = {
        option_id: option.id,
        rhetorical_plan: { reference: p.reference, archetype: p.archetype },
      };
      expect(resolveProseSelection(selection, options)).toBe(option);
      expect(() =>
        resolveProseSelection(
          {
            ...selection,
            rhetorical_plan: {
              ...selection.rhetorical_plan,
              reference: "rp1." + "0".repeat(24),
            },
          },
          options,
        ),
      ).toThrow();
      expect(() =>
        resolveProseSelection({ option_id: option.id }, options),
      ).toThrow();
      expect(() =>
        validateOutreachProvenance({
          body: option.body,
          subject: option.subject,
          claims: option.claims,
          context,
          bodyConstraint: resolveOutputConstraint({
            category,
            emailMode: "initial_outreach",
          }),
          renderedSignature: category === "cold_email",
        }),
      ).not.toThrow();
    }
  },
);

it("offers email drafts using both selected stories and rejects a missing root", () => {
  const { context, outcome } = proseFixture("cold_email", "initial_outreach");
  const actionSource = context.atomicSources!.find((s) => s.kind === "action")!;
  const outcomeSource = context.atomicSources!.find(
    (s) => s.kind === "outcome",
  )!;
  const secondRoot = "evidence:ae550000-2222-4222-8222-222222222222";
  outcomeSource.rootId = secondRoot;
  outcomeSource.id = secondRoot + ".fact.synthetic";
  context.sources.push({
    id: secondRoot,
    type: "evidence",
    label: "Review guide",
    content: outcome,
    priority: 1,
  });
  // Both stories contain this outcome, but only the second depends on it.
  const duplicate = {
    ...outcomeSource,
    rootId: actionSource.rootId!,
    id: actionSource.rootId + ".fact.duplicate",
  };
  context.atomicSources!.unshift(duplicate);
  context.requiredEvidenceRoots = [actionSource.rootId!, secondRoot];
  const input = {
    category: "cold_email",
    emailMode: "initial_outreach",
    context,
  } as const;

  const options = buildProseCompositions(input);
  expect(options.length).toBeGreaterThan(0);
  for (const option of options) {
    expect(option.claims.map((claim) => claim.source_id)).toEqual(
      expect.arrayContaining([actionSource.id, outcomeSource.id]),
    );
  }

  context.atomicSources = context.atomicSources!.filter(
    (source) => source !== outcomeSource,
  );
  expect(() => buildProseCompositions(input)).toThrow(
    ProseGroundingUnavailableError,
  );
});
