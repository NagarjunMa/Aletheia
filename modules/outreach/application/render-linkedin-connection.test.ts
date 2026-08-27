import { describe, expect, it } from "vitest";
import { renderLinkedinConnection } from "./render-linkedin-connection";

const source = {
  id: "evidence:workflow",
  label: "LLM review workflow",
  type: "evidence" as const,
  priority: 1 as const,
  content:
    "Built and operated an LLM-assisted review workflow for engineering teams.",
};

const draft = {
  target_observation: "Your developer tooling work stood out.",
  candidate_relevance: {
    text: "I built an LLM-assisted review workflow for engineers.",
    source_ids: [source.id],
  },
  cta: "Open to a brief chat?",
};

describe("renderLinkedinConnection", () => {
  it("renders a complete, source-validated note without post-render truncation", () => {
    const result = renderLinkedinConnection({ draft, sources: [source] });
    expect(result.body).toBe(
      "Your developer tooling work stood out. I built an LLM-assisted review workflow for engineers. Open to a brief chat?",
    );
    expect(result.characterCount).toBeLessThanOrEqual(300);
    expect(result.hasCandidateRelevance).toBe(true);
  });

  it("permits target-only notes only with an explicit null relevance", () => {
    const result = renderLinkedinConnection({
      draft: { ...draft, candidate_relevance: null },
      sources: [],
    });
    expect(result.body).not.toContain("LLM-assisted");
    expect(result.hasCandidateRelevance).toBe(false);
  });

  it("rejects unknown, unsupported, and overlength candidate output", () => {
    expect(() =>
      renderLinkedinConnection({
        draft: {
          ...draft,
          candidate_relevance: {
            text: "I led a security platform.",
            source_ids: [source.id],
          },
        },
        sources: [source],
      }),
    ).toThrow();
    expect(() =>
      renderLinkedinConnection({
        draft: {
          ...draft,
          candidate_relevance: {
            ...draft.candidate_relevance,
            source_ids: ["unknown"],
          },
        },
        sources: [source],
      }),
    ).toThrow();
    expect(() =>
      renderLinkedinConnection({
        draft: { ...draft, target_observation: "x".repeat(250) },
        sources: [source],
      }),
    ).toThrow();
    expect(() =>
      renderLinkedinConnection({
        draft: { ...draft, cta: "   " },
        sources: [source],
      }),
    ).toThrow();
  });
});
