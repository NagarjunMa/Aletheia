import { describe, expect, it } from "vitest";
import { validateAtomicOutput } from "@/modules/grounding/application/validate-atomic-claims";
import {
  sanitizeYcApplicationOutput,
  YcApplicationOutputSanitizationError,
} from "./sanitize-yc-application-output";

const evidenceId = "evidence:11111111-1111-4111-8111-111111111111";

describe("YC application output sanitation guardrails", () => {
  it("fails closed when a blocked pattern appears in the body or claim ledger", async () => {
    const unsafeClaim = "I built a nazi-related workflow.";

    await expect(
      sanitizeYcApplicationOutput({
        body: `${unsafeClaim} I then supported customers through the release.`,
        claims: [{ text: unsafeClaim, sourceIds: [evidenceId] }],
      }),
    ).rejects.toBeInstanceOf(YcApplicationOutputSanitizationError);
  });

  it("redacts the public body and rejects changed evidence rather than rewriting its ledger", async () => {
    const claim = "I handled an incident involving SSN 123-45-6789.";
    const claims = [
      {
        text: claim,
        kind: "action" as const,
        source_id: evidenceId,
        supporting_excerpt: claim,
      },
    ];
    const sources = [
      {
        id: evidenceId,
        kind: "action" as const,
        scope: "candidate" as const,
        content: claim,
      },
    ];
    const validate = (text: string) =>
      validateAtomicOutput({
        claims,
        sources,
        excludedClaims: [],
        fields: [{ text, scope: "candidate" }],
      });
    expect(() => validate(claim)).not.toThrow();
    const result = await sanitizeYcApplicationOutput({
      body: claim,
      claims: claims.map((entry) => ({ ...entry, sourceIds: [evidenceId] })),
    });

    expect(result.output.body).not.toContain("123-45-6789");
    expect(result.output.claims[0]?.text).toBe(claim);
    expect(() => validate(result.output.body)).toThrow(
      expect.objectContaining({ code: "CLAIM_COVERAGE" }),
    );
  });
});
