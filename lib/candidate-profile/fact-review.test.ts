import { describe, expect, it } from "vitest";
import { candidateEvidenceInputSchema } from "./schema";
import {
  evidenceReviewSource,
  prepareFactReview,
  readFactReview,
} from "./fact-review";

const evidence = candidateEvidenceInputSchema.parse({
  kind: "technical_project",
  title: "Policy agent",
  context: "A training prototype, not production.",
  actions: "I built a policy-grounded prototype.",
  confirmed: true,
});
const fact = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "action",
  excerpt: evidence.actions,
  confirmed: true,
};

describe("one-time individual fact review", () => {
  it("retains individually confirmed types and exact source excerpts", () => {
    const review = prepareFactReview(evidence, [fact]);
    expect(
      readFactReview(evidence, JSON.parse(JSON.stringify(review))),
    ).toEqual([fact]);
  });
  it("binds a review to every source field, including cross-field qualifications", () => {
    const review = prepareFactReview(evidence, [fact]);
    expect(
      readFactReview({ ...evidence, context: "Production service." }, review),
    ).toEqual([]);
    expect(readFactReview({ ...evidence, confirmed: false }, review)).toEqual(
      [],
    );
    expect(evidenceReviewSource(evidence)).toContain("training prototype");
    expect(evidenceReviewSource(evidence)).not.toBe(
      evidenceReviewSource({ ...evidence, links: ["https://example.test"] }),
    );
  });
  it.each([
    [{ ...fact, confirmed: false }],
    [{ ...fact, excerpt: "I deployed a production policy agent." }],
    [{ ...fact, kind: "target_observation" }],
    [{ ...fact, excerpt: "x".repeat(601) }],
    [fact, fact],
    Array.from({ length: 9 }, (_, index) => ({
      ...fact,
      id: `11111111-1111-4111-8111-11111111111${index}`,
      excerpt: evidence.actions.slice(index),
    })),
  ])("rejects unsupported, unconfirmed or unbounded facts", (...facts) => {
    expect(() => prepareFactReview(evidence, facts)).toThrow(
      "Facts could not be verified",
    );
  });
  it("treats legacy, malformed and forged-source reviews as unreviewed", () => {
    expect(readFactReview(evidence, null)).toEqual([]);
    expect(
      readFactReview(evidence, {
        version: 1,
        source: evidenceReviewSource(evidence),
        facts: [{ ...fact, excerpt: "Invented claim" }],
      }),
    ).toEqual([]);
  });
  it("allows withdrawing all facts without changing the saved story", () => {
    expect(readFactReview(evidence, prepareFactReview(evidence, []))).toEqual(
      [],
    );
  });
  it("does not allow reviewing a project whose confirmation was withdrawn", () => {
    expect(() =>
      prepareFactReview({ ...evidence, confirmed: false }, [fact]),
    ).toThrow("Facts could not be verified");
  });
});
