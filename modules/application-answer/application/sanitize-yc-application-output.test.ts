import { describe, expect, it } from "vitest";
import goldenCases from "@/lib/ai/evals/yc-application-golden-cases.json";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import type { YcApplicationToolOutput } from "../infrastructure/anthropic-yc.repository";
import {
  sanitizeYcApplicationOutput,
  YcApplicationOutputSanitizationError,
} from "./sanitize-yc-application-output";
import { validateYcApplicationOutput } from "./validate-yc-application-output";

const evidenceId = "evidence:11111111-1111-4111-8111-111111111111";
const groundedClaim =
  "I designed an observability workflow -- reduced incident response time by 40 percent.";
const body = `${groundedClaim} With that in mind, I use that experience to make production work clearer for a small team. I have also built TypeScript services, partnered with operators, and handled the follow-up work needed after launch with close attention to reliability, customer feedback, and practical delivery tradeoffs.`;

const context: YcGroundingContext = {
  question: "Why are you a strong candidate for this role?",
  jobDescription: "Build reliable TypeScript services for an early-stage team.",
  sources: [
    {
      id: evidenceId,
      type: "evidence",
      label: "Observability workflow",
      content:
        "Designed an observability workflow and reduced incident response time by 40 percent.",
      priority: 1,
    },
  ],
  excludedClaims: [],
  readiness: { ready: true, missingFields: [], recommendedFields: [] },
  metadata: {
    profileFieldCount: 0,
    confirmedEvidenceCount: 1,
    resumeSource: "none",
  },
};

function output(overrides: Partial<YcApplicationToolOutput> = {}) {
  return {
    body,
    claims: [{ text: groundedClaim, sourceIds: [evidenceId] }],
    ...overrides,
  };
}

describe("sanitizeYcApplicationOutput", () => {
  it("rewrites body and claim text together while retaining claim containment", async () => {
    const result = await sanitizeYcApplicationOutput(output());

    expect(result.output.body).not.toContain(" -- ");
    expect(result.output.body).not.toContain("With that in mind");
    expect(result.output.claims[0]?.text).toBe(
      "I designed an observability workflow - reduced incident response time by 40 percent.",
    );
    expect(result.output.body).toContain(result.output.claims[0]?.text ?? "");
    expect(result.metadata.fingerprintPatterns).toEqual(
      expect.arrayContaining(["spaced_double_hyphen", "ai_transition_mind"]),
    );
    expect(result.metadata.fingerprintPatternCount).toBe(
      result.metadata.fingerprintPatterns.length,
    );
    expect(
      validateYcApplicationOutput({ context, output: result.output }),
    ).toEqual(
      expect.objectContaining({
        claims: result.output.claims,
        wordCount: expect.any(Number),
      }),
    );
  });

  it("fails closed when sanitation removes a claim", async () => {
    await expect(
      sanitizeYcApplicationOutput(
        output({
          body: "I'll keep this brief.",
          claims: [
            {
              text: "I'll keep this brief.",
              sourceIds: [evidenceId],
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(YcApplicationOutputSanitizationError);
  });

  it("fails closed when fingerprint rewriting expands an answer beyond its tool limit", async () => {
    const claim = "I built reliable TypeScript services.";
    const prefix = `${claim} I collaborated… with customers. `;
    const rawBody = `${prefix}${"x".repeat(3_000 - prefix.length)}`;

    expect(rawBody).toHaveLength(3_000);
    await expect(
      sanitizeYcApplicationOutput(
        output({
          body: rawBody,
          claims: [{ text: claim, sourceIds: [evidenceId] }],
        }),
      ),
    ).rejects.toThrow("Generated answer exceeded the sanitization limit");
  });

  it("does not alter command flags, version strings, or hyphenated technical terms", async () => {
    const technicalClaim =
      "I used TypeScript 5.6.0 to build event-driven services and verified deployments with --help.";
    const result = await sanitizeYcApplicationOutput(
      output({
        body: `${technicalClaim} I also worked with operators, tested the service, and supported customers after the release so the team could learn from real production use.`,
        claims: [{ text: technicalClaim, sourceIds: [evidenceId] }],
      }),
    );

    expect(result.output.body).toContain("TypeScript 5.6.0");
    expect(result.output.body).toContain("event-driven");
    expect(result.output.body).toContain("--help");
    expect(result.output.claims[0]?.text).toBe(technicalClaim);
  });

  it("passes the YC application fingerprint regression fixture", async () => {
    const fixture = goldenCases.find(
      (entry) => entry.id === "technical-depth-production-ownership",
    ) as (typeof goldenCases)[number] & {
      sanitizationRegression: {
        body: string;
        claims: YcApplicationToolOutput["claims"];
        expectedPatterns: string[];
        expectedAbsent: string[];
        expectedPresent: string[];
      };
    };

    const result = await sanitizeYcApplicationOutput(
      fixture.sanitizationRegression,
    );

    expect(result.metadata.fingerprintPatterns).toEqual(
      expect.arrayContaining(fixture.sanitizationRegression.expectedPatterns),
    );
    for (const forbidden of fixture.sanitizationRegression.expectedAbsent) {
      expect(result.output.body).not.toContain(forbidden);
    }
    for (const preserved of fixture.sanitizationRegression.expectedPresent) {
      expect(result.output.body).toContain(preserved);
    }
  });
});
