import { describe, expect, it } from "vitest";

import goldenCases from "./linkedin-connection-golden-cases.json";
import {
  evaluateLinkedInConnectionQuality,
  type GoldenLinkedInConnectionCase,
} from "./linkedin-connection-quality";

const cases = goldenCases as GoldenLinkedInConnectionCase[];

describe("LinkedIn connection quality evals", () => {
  it.each(cases)("passes preferred output for $id", (goldenCase) => {
    const result = evaluateLinkedInConnectionQuality(
      goldenCase.preferred,
      goldenCase.expectedRules,
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it.each(cases)("flags generated output for $id", (goldenCase) => {
    const result = evaluateLinkedInConnectionQuality(
      goldenCase.generated,
      goldenCase.expectedRules,
    );

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
