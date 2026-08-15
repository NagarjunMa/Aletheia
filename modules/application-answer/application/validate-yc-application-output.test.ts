import { describe, expect, it } from "vitest";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import {
  validateYcApplicationOutput,
  YcApplicationOutputValidationError,
} from "./validate-yc-application-output";

const evidenceId = "evidence:11111111-1111-4111-8111-111111111111";

function context(
  overrides: Partial<YcGroundingContext> = {},
): YcGroundingContext {
  return {
    question: "Why are you a strong candidate for this role?",
    jobDescription:
      "Build TypeScript services and own delivery in an early-stage team.",
    sources: [
      {
        id: evidenceId,
        type: "evidence",
        label: "Production delivery",
        content:
          "Built and operated customer-facing TypeScript services. Reduced incident response time by 40 percent.",
        priority: 1,
      },
      {
        id: "profile.current_role",
        type: "profile",
        label: "Current role",
        content: "Platform Engineer",
        priority: 2,
      },
    ],
    excludedClaims: ["FastAPI", "people management"],
    readiness: { ready: true, missingFields: [], recommendedFields: [] },
    metadata: {
      profileFieldCount: 1,
      confirmedEvidenceCount: 1,
      resumeSource: "none",
    },
    ...overrides,
  };
}

const groundedClaim =
  "I built and operated customer-facing TypeScript services.";

function bodyWithWords(count: number, prefix = groundedClaim): string {
  const prefixWords = prefix.trim().split(/\s+/u);
  const remaining = Math.max(0, count - prefixWords.length);
  return `${prefix} ${Array.from({ length: remaining }, () => "delivery").join(" ")}`.trim();
}

function output(body = bodyWithWords(50)) {
  return {
    body,
    claims: [{ text: groundedClaim, sourceIds: [evidenceId] }],
  };
}

describe("validateYcApplicationOutput", () => {
  it.each([50, 150])(
    "accepts a grounded answer at the %s-word boundary",
    (wordCount) => {
      expect(
        validateYcApplicationOutput({
          output: output(bodyWithWords(wordCount)),
          context: context(),
        }),
      ).toEqual(
        expect.objectContaining({
          wordCount,
          characterCount: expect.any(Number),
          claims: [{ text: groundedClaim, sourceIds: [evidenceId] }],
        }),
      );
    },
  );

  it.each([49, 151])("rejects a %s-word answer", (wordCount) => {
    expect(() =>
      validateYcApplicationOutput({
        output: output(bodyWithWords(wordCount)),
        context: context(),
      }),
    ).toThrow(YcApplicationOutputValidationError);
  });

  it("rejects unknown, missing, and non-verbatim claim references", () => {
    expect(() =>
      validateYcApplicationOutput({
        output: {
          ...output(),
          claims: [{ text: groundedClaim, sourceIds: ["evidence:unknown"] }],
        },
        context: context(),
      }),
    ).toThrow(/unknown source/iu);

    expect(() =>
      validateYcApplicationOutput({
        output: { ...output(), claims: [] },
        context: context(),
      }),
    ).toThrow(/claim/iu);

    expect(() =>
      validateYcApplicationOutput({
        output: {
          ...output(),
          claims: [
            {
              text: "This claim does not appear in the answer.",
              sourceIds: [evidenceId],
            },
          ],
        },
        context: context(),
      }),
    ).toThrow(/verbatim/iu);
  });

  it.each(["FastAPI", "Fast API", "people-management"])(
    "rejects prohibited claim variant %s",
    (claim) => {
      const body = bodyWithWords(
        50,
        `${groundedClaim} My work also includes ${claim}.`,
      );
      expect(() =>
        validateYcApplicationOutput({
          output: output(body),
          context: context(),
        }),
      ).toThrow(/excluded claim/iu);
    },
  );

  it.each([
    "Hi Alex,",
    "Dear hiring team,",
    "I would love to schedule a call.",
    "Best,\nNagarjun",
    "I am the perfect candidate for this role.",
  ])("rejects forbidden application framing: %s", (framing) => {
    expect(() =>
      validateYcApplicationOutput({
        output: output(bodyWithWords(50, `${framing} ${groundedClaim}`)),
        context: context(),
      }),
    ).toThrow(/forbidden framing/iu);
  });

  it("rejects a metric that is absent from every cited source", () => {
    const fabricatedMetric = "I reduced incident response time by 75 percent.";
    expect(() =>
      validateYcApplicationOutput({
        output: {
          body: bodyWithWords(50, `${groundedClaim} ${fabricatedMetric}`),
          claims: [
            { text: groundedClaim, sourceIds: [evidenceId] },
            { text: fabricatedMetric, sourceIds: [evidenceId] },
          ],
        },
        context: context(),
      }),
    ).toThrow(/unsupported metric/iu);
  });

  it("allows a metric found in a cited source", () => {
    const supportedMetric = "I reduced incident response time by 40 percent.";
    expect(() =>
      validateYcApplicationOutput({
        output: {
          body: bodyWithWords(50, `${groundedClaim} ${supportedMetric}`),
          claims: [
            { text: groundedClaim, sourceIds: [evidenceId] },
            { text: supportedMetric, sourceIds: [evidenceId] },
          ],
        },
        context: context(),
      }),
    ).not.toThrow();
  });
});
