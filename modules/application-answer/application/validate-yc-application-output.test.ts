import { describe, expect, it } from "vitest";
import { AtomicClaimValidationError } from "@/modules/grounding/application/validate-atomic-claims";
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
    atomicSources: [
      {
        id: evidenceId,
        scope: "candidate",
        kind: "action",
        content: bodyWithWords(50),
      },
      {
        id: "metric",
        scope: "candidate",
        kind: "metric",
        content: bodyWithWords(
          50,
          "I reduced incident response time by 40 percent.",
        ),
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
  if (count === 150) return Array(3).fill(bodyWithWords(50, prefix)).join(" ");
  const prefixWords = prefix.trim().split(/\s+/u);
  const remaining = Math.max(0, count - prefixWords.length);
  return `${prefix} ${Array.from({ length: remaining }, () => "delivery").join(" ")}`.trim();
}

function output(body = bodyWithWords(50)) {
  return {
    body,
    claims: [
      {
        text: bodyWithWords(50),
        sourceIds: [evidenceId],
        source_id: evidenceId,
        kind: "action" as const,
        supporting_excerpt: bodyWithWords(50),
      },
    ],
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
          claims: [{ text: bodyWithWords(50), sourceIds: [evidenceId] }],
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
          claims: [{ ...output().claims[0]!, source_id: "evidence:unknown" }],
        },
        context: context(),
      }),
    ).toThrow(expect.objectContaining({ code: "CLAIM_SOURCE" }));

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
              ...output().claims[0]!,
              text: "This claim does not appear in the answer.",
            },
          ],
        },
        context: context(),
      }),
    ).toThrow(expect.objectContaining({ code: "CLAIM_REWRITE" }));
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

  it("rejects a metric that is absent from the exact cited excerpt", () => {
    const supported = bodyWithWords(
      50,
      "I reduced incident response time by 40 percent.",
    );
    const fabricated = supported.replace("40", "75");
    expect(() =>
      validateYcApplicationOutput({
        context: context(),
        output: {
          body: fabricated,
          claims: [
            {
              text: fabricated,
              sourceIds: ["metric"],
              source_id: "metric",
              kind: "metric",
              supporting_excerpt: supported,
            },
          ],
        },
      }),
    ).toThrow(AtomicClaimValidationError);
  });
  it("allows the unchanged metric in a complete supported source", () => {
    const supported = bodyWithWords(
      50,
      "I reduced incident response time by 40 percent.",
    );
    expect(() =>
      validateYcApplicationOutput({
        context: context(),
        output: {
          body: supported,
          claims: [
            {
              text: supported,
              sourceIds: ["metric"],
              source_id: "metric",
              kind: "metric",
              supporting_excerpt: supported,
            },
          ],
        },
      }),
    ).not.toThrow();
  });
});
