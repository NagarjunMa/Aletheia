import { describe, expect, it } from "vitest";
import outreach from "./outreach-discourse-golden-cases.json";
import applications from "./application-discourse-golden-cases.json";
import { parseDiscourseFixtures, summarizeDiscourse } from "./discourse-corpus";
import { evaluateOutreachDiscourse } from "./outreach-discourse-quality";
import { evaluateApplicationDiscourse } from "./application-discourse-quality";
const fixtures = parseDiscourseFixtures([...outreach, ...applications]);
function evaluate(f: (typeof fixtures)[number]) {
  const { expectedViolations: _expected, ...sample } = f;
  return sample.category === "yc_application"
    ? evaluateApplicationDiscourse(sample)
    : evaluateOutreachDiscourse(sample);
}
describe("locked synthetic discourse corpus", () => {
  it.each(fixtures)("meets manually authored properties for $id", (fixture) => {
    expect(evaluate(fixture).violations).toEqual(fixture.expectedViolations);
  });
  it("separates required template repetition and harmful long-message pattern rates", () => {
    const controls = fixtures
      .filter((f) => f.expectedViolations.length === 0)
      .map(evaluate);
    const groups = summarizeDiscourse(controls);
    const initial = groups.find(
      (g) => g.group === "cold_email/initial_outreach",
    )!;
    expect(initial.pattern).toEqual({ numerator: 3, denominator: 3, rate: 1 });
    expect(initial.harmfulPattern).toBe(true);
    const short = groups.find(
      (g) => g.group === "linkedin_connection/initial_outreach",
    )!;
    expect(short.cta.rate).toBe(1);
    expect(short.harmfulPattern).toBe(false);
    expect(short.pattern).toEqual({ numerator: 0, denominator: 0, rate: null });
    expect(short.diversityEvidence).toBe("insufficient");
    expect(summarizeDiscourse([])).toEqual([]);
    expect(
      groups.find((g) => g.group === "yc_application/initial_outreach")!.cta,
    ).toEqual({ numerator: 0, denominator: 0, rate: null });
  });
  it("does not inflate a group with duplicate fixture IDs", () => {
    expect(() => parseDiscourseFixtures([fixtures[0], fixtures[0]])).toThrow(
      "Invalid synthetic fixture set",
    );
  });
  it.each([
    "https://real-person.invalid/resume",
    "real-person@example.invalid",
    "sk-ant-PRIVATE_CANARY",
    "www.aletheia.live",
    "Nagarjun",
  ])(
    "rejects privacy-negative fixture controls without echoing text",
    (text) => {
      expect(() =>
        parseDiscourseFixtures([{ ...fixtures[0], body: text }]),
      ).toThrow("Synthetic fixture privacy check failed");
    },
  );
});

it.each(["+1 (202) 555-0123", "(202)555-0123", "202-555-0123", "2025550123"])(
  "ALE48-R1-004 rejects phone-shaped contacts %s",
  (phone) => {
    expect(() =>
      parseDiscourseFixtures([
        { ...fixtures[0], body: `Synthetic contact: ${phone}` },
      ]),
    ).toThrow("Synthetic fixture privacy check failed");
  },
);
