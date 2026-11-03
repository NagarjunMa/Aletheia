import { describe, expect, it, vi } from "vitest";
import { buildRhetoricalPlan, rhetoricalPlansEnabled } from "./rhetorical-plan";
import { allowedClaimTexts, type AtomicSource } from "./atomic-claim";
const sources: AtomicSource[] = [
  {
    id: "target.1",
    scope: "target",
    kind: "target_observation",
    content: "The team builds evaluation tools.",
  },
  {
    id: "candidate.1",
    scope: "candidate",
    kind: "action",
    content: "I built evaluation tools.",
  },
  {
    id: "candidate.2",
    scope: "candidate",
    kind: "outcome",
    content: "The team used the tools.",
  },
];
const claims = sources.map((s) => ({
  text: allowedClaimTexts(s).at(-1)!,
  source_id: s.id,
  kind: s.kind,
  supporting_excerpt: s.content,
}));
describe("rhetorical plans", () => {
  it("binds complete current facts deterministically", () => {
    const input = { category: "cold_email" as const, claims, sources };
    const plan = buildRhetoricalPlan(input);
    expect(plan).toEqual(buildRhetoricalPlan(input));
    expect([...plan.sourceIds].sort()).toEqual(sources.map((s) => s.id).sort());
    expect(plan.reference).toMatch(/^rp1\.[a-f0-9]{24}$/);
  });
  it("rejects source-less and foreign facts", () => {
    expect(() =>
      buildRhetoricalPlan({ category: "cold_email", claims: [], sources: [] }),
    ).toThrow();
    expect(() =>
      buildRhetoricalPlan({ category: "cold_email", claims, sources: [] }),
    ).toThrow();
  });
  it("never offers outcome-led LinkedIn or candidate-free YC", () => {
    expect(
      buildRhetoricalPlan({ category: "linkedin_connection", claims, sources })
        .archetype,
    ).not.toBe("outcome_led");
    expect(() =>
      buildRhetoricalPlan({
        category: "yc_application",
        claims: [claims[0]!],
        sources,
      }),
    ).toThrow();
  });
});
it("does not depend on caller object property insertion order", () => {
  const a = buildRhetoricalPlan({ category: "cold_email", claims, sources });
  const b = buildRhetoricalPlan({ sources, claims, category: "cold_email" });
  expect(a).toEqual(b);
});
it("uses only the exact server flag and rejects duplicate or rewritten facts", () => {
  for (const bad of [
    [{ ...claims[0]!, text: "Unsupported new fact." }],
    [...claims, claims[0]!],
  ])
    expect(() =>
      buildRhetoricalPlan({ category: "cold_email", claims: bad, sources }),
    ).toThrow();
  expect(() =>
    buildRhetoricalPlan({
      category: "cold_email",
      claims,
      sources: [...sources, sources[0]!],
    }),
  ).toThrow();
});

it("defaults the server flag off and requires exact affirmative configuration", () => {
  for (const value of ["", "false", "TRUE", "1"]) {
    vi.stubEnv("RHETORICAL_PLANS_ENABLED", value);
    expect(rhetoricalPlansEnabled()).toBe(false);
  }
  vi.stubEnv("RHETORICAL_PLANS_ENABLED", "true");
  expect(rhetoricalPlansEnabled()).toBe(true);
  vi.unstubAllEnvs();
});
