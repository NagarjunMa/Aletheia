import { describe, expect, it } from "vitest";
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

  it("redacts sensitive values consistently in the body and claim ledger", async () => {
    const claim = "I handled an incident involving SSN 123-45-6789.";
    const result = await sanitizeYcApplicationOutput({
      body: `${claim} I documented the response, coordinated remediation, and improved the production workflow after the incident.`,
      claims: [{ text: claim, sourceIds: [evidenceId] }],
    });

    expect(result.output.body).not.toContain("123-45-6789");
    expect(result.output.claims[0]?.text).not.toContain("123-45-6789");
    expect(result.output.body).toContain(result.output.claims[0]?.text ?? "");
  });
});
