import { it, expect, vi } from "vitest";
import savedBaseline from "../../../docs/evals/grounded-response-baseline.json";
import {
  buildRhetoricalDiscourseVariant,
  compareDiscourseVariant,
  runDiscourseBaseline,
} from "./grounded-discourse-report";
it("keeps the disabled ALE-48 baseline exact and passes enabled shape/safety gates without I/O", () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("No external calls"));
  try {
    expect(runDiscourseBaseline()).toEqual(savedBaseline);
    const variant = buildRhetoricalDiscourseVariant();
    expect(buildRhetoricalDiscourseVariant()).toEqual(variant);
    const result = compareDiscourseVariant(variant);
    expect(result.safetyAndObligations).toBe(true);
    expect(result.negativeControlsPreserved).toBe(true);
    expect(result.diversityImproved).toBe(true);
    expect(result.decision).toBe("eligible_for_human_and_provider_review");
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});
