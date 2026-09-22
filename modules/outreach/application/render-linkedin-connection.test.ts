import { describe, expect, it } from "vitest";
import {
  LinkedinConnectionValidationError,
  renderLinkedinConnection,
} from "./render-linkedin-connection";
import {
  LINKEDIN_CONNECTION_COMPONENT_MAX_CHARACTERS,
  LINKEDIN_CONNECTION_MAX_CHARACTERS,
} from "../domain/outreach-draft.types";

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
  character_count: 118,
};

describe("renderLinkedinConnection", () => {
  it("renders a complete, source-validated note without post-render truncation", () => {
    const expectedBody =
      "Your developer tooling work stood out. I built an LLM-assisted review workflow for engineers. Open to a brief chat?";
    const result = renderLinkedinConnection({
      draft: { ...draft, character_count: expectedBody.length },
      sources: [source],
    });
    expect(result.body).toBe(expectedBody);
    expect(result.characterCount).toBeLessThanOrEqual(300);
    expect(result.hasCandidateRelevance).toBe(true);
  });

  it("permits target-only notes only with an explicit null relevance", () => {
    const body = `${draft.target_observation} ${draft.cta}`;
    const result = renderLinkedinConnection({
      draft: {
        ...draft,
        candidate_relevance: null,
        character_count: body.length,
      },
      sources: [],
    });
    expect(result.body).not.toContain("LLM-assisted");
    expect(result.hasCandidateRelevance).toBe(false);
  });

  it("keeps the worst-case schema composition inside the final envelope", () => {
    const { targetObservation, candidateRelevance, cta } =
      LINKEDIN_CONNECTION_COMPONENT_MAX_CHARACTERS;
    expect(
      targetObservation + candidateRelevance + cta + 2,
    ).toBeLessThanOrEqual(LINKEDIN_CONNECTION_MAX_CHARACTERS);
  });

  it.each([
    [
      "CONNECTION_UNKNOWN_SOURCE",
      {
        candidate_relevance: {
          ...draft.candidate_relevance,
          source_ids: ["unknown"],
        },
      },
    ],
    [
      "CONNECTION_SOURCE_OVERLAP_FAILED",
      {
        candidate_relevance: {
          ...draft.candidate_relevance,
          text: "I led a security platform.",
        },
      },
    ],
    ["CONNECTION_EMPTY_SECTION", { cta: "   " }],
    [
      "CONNECTION_OVER_LIMIT",
      {
        target_observation: "x".repeat(250),
        character_count: 350,
      },
    ],
    ["CONNECTION_DECLARED_COUNT_MISMATCH", { character_count: 1 }],
  ])("reports %s without exposing content", (code, overrides) => {
    try {
      renderLinkedinConnection({
        draft: { ...draft, ...overrides },
        sources: [source],
      });
      throw new Error("Expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LinkedinConnectionValidationError);
      expect((error as LinkedinConnectionValidationError).code).toBe(code);
      if (code === "CONNECTION_OVER_LIMIT") {
        expect(
          (error as LinkedinConnectionValidationError).safeMetadata,
        ).toMatchObject({
          actualCharacterCount: expect.any(Number),
          maximumCharacterCount: 300,
        });
      }
      if (code === "CONNECTION_DECLARED_COUNT_MISMATCH") {
        expect(
          (error as LinkedinConnectionValidationError).safeMetadata,
        ).toMatchObject({
          actualCharacterCount: expect.any(Number),
          declaredCharacterCount: 1,
        });
      }
      expect((error as Error).message).not.toContain(source.content);
      expect((error as Error).message).not.toContain(draft.cta);
    }
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
