import { describe, expect, it } from "vitest";
import {
  LinkedinConnectionValidationError,
  renderLinkedinConnection,
} from "./render-linkedin-connection";
import {
  LINKEDIN_CONNECTION_MAX_CHARACTERS,
  linkedinConnectionDraftSchema,
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
};

describe("renderLinkedinConnection", () => {
  it("renders a complete, source-validated note without post-render truncation", () => {
    const expectedBody =
      "Your developer tooling work stood out. I built an LLM-assisted review workflow for engineers. Open to a brief chat?";
    const result = renderLinkedinConnection({
      draft,
      sources: [source],
    });
    expect(result.body).toBe(expectedBody);
    expect(result.characterCount).toBeLessThanOrEqual(300);
    expect(result.hasCandidateRelevance).toBe(true);
  });

  it.each([
    [90, 62, 254],
    [80, 57, 239],
  ])(
    "renders %i-character observation and %i-character CTA to %i characters",
    (observationLength, ctaLength, actualCount) => {
      const result = renderLinkedinConnection({
        draft: {
          target_observation: "T".repeat(observationLength),
          candidate_relevance: {
            text: `workflow ${"x".repeat(91)}`,
            source_ids: [source.id],
          },
          cta: "C".repeat(ctaLength),
        },
        sources: [source],
      });
      expect(result.body.length).toBe(actualCount);
      expect(result.characterCount).toBe(actualCount);
    },
  );

  it("permits target-only notes only with an explicit null relevance", () => {
    const result = renderLinkedinConnection({
      draft: {
        ...draft,
        candidate_relevance: null,
      },
      sources: [],
    });
    expect(result.body).not.toContain("LLM-assisted");
    expect(result.hasCandidateRelevance).toBe(false);
  });

  it.each([299, 300, 301])(
    "enforces the %i-character normalized final envelope",
    (length) => {
      const input = linkedinConnectionDraftSchema.parse({
        claims: [],
        target_observation: `  ${"é".repeat(length - 24)}😀\n\t`,
        candidate_relevance: null,
        cta: "Open to a brief chat?",
      });
      const render = () =>
        renderLinkedinConnection({ draft: input, sources: [] });
      if (length > LINKEDIN_CONNECTION_MAX_CHARACTERS) {
        expect(render).toThrow(LinkedinConnectionValidationError);
      } else {
        expect(render().body.length).toBe(length);
        expect(render().body).toMatch(/ Open to a brief chat\?$/);
      }
    },
  );

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
      },
    ],
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
