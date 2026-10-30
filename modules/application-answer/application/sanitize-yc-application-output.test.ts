import { describe, expect, it } from "vitest";
import goldenCases from "@/lib/ai/evals/yc-application-golden-cases.json";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import type { YcApplicationToolOutput } from "../infrastructure/anthropic-yc.repository";
import { sanitizeYcApplicationOutput } from "./sanitize-yc-application-output";
import { validateYcApplicationOutput } from "./validate-yc-application-output";

const evidenceId = "evidence:11111111-1111-4111-8111-111111111111";
const groundedClaim =
  "I designed an observability workflow -- reduced incident response time by 40 percent. With that in mind, I use that experience to make production work clearer for a small team. I have also built TypeScript services, partnered with operators, and handled the follow-up work needed after launch with close attention to reliability, customer feedback, and practical delivery tradeoffs.";
const body = groundedClaim;

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
  atomicSources: [
    {
      id: evidenceId,
      kind: "action",
      scope: "candidate",
      content: groundedClaim,
    },
  ],
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
    claims: [
      {
        text: groundedClaim,
        sourceIds: [evidenceId],
        source_id: evidenceId,
        kind: "action" as const,
        supporting_excerpt: groundedClaim,
      },
    ],
    ...overrides,
  };
}

describe("sanitizeYcApplicationOutput", () => {
  it("preserves source-backed wording and detects style without rewriting", async () => {
    expect(() =>
      validateYcApplicationOutput({ context, output: output() }),
    ).not.toThrow();
    const result = await sanitizeYcApplicationOutput(output());

    expect(result.output.body).toBe(body);
    expect(result.output.claims[0]?.text).toBe(groundedClaim);
    expect(result.metadata.fingerprintPatterns).toEqual(
      expect.arrayContaining(["spaced_double_hyphen", "ai_transition_mind"]),
    );
    expect(result.metadata.fingerprintPatternCount).toBe(
      result.metadata.fingerprintPatterns.length,
    );
    expect(() =>
      validateYcApplicationOutput({ context, output: result.output }),
    ).not.toThrow();
  });

  it("preserves short text for the final grounding and length checks", async () => {
    const input = output({ body: "I'll keep this brief." });
    const result = await sanitizeYcApplicationOutput(input);
    expect(result.output.body).toBe(input.body);
    expect(() =>
      validateYcApplicationOutput({ context, output: result.output }),
    ).toThrow(expect.objectContaining({ code: "CLAIM_COVERAGE" }));
  });

  it("fails closed when Unicode equivalence expands an answer beyond its tool limit", async () => {
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
    ).rejects.toThrow(
      "Generated answer exceeded or failed the sanitization limit",
    );
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
    expect(result.output.body).toBe(fixture.sanitizationRegression.body);
    for (const preserved of fixture.sanitizationRegression.expectedPresent) {
      expect(result.output.body).toContain(preserved);
    }
  });
});
