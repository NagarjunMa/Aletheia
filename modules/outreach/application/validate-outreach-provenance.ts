import {
  normalizeClaimText,
  validateAtomicOutput,
} from "@/modules/grounding/application/validate-atomic-claims";
import type { OutreachGroundingContext } from "../domain/outreach-grounding.types";

/** Only the exact server-inserted terminal identity can bypass model claims. */
export function validateOutreachProvenance(input: {
  body: string;
  subject: string;
  claims: unknown;
  context: OutreachGroundingContext;
  renderedSignature?: boolean;
}): void {
  let body = normalizeClaimText(input.body);
  if (input.renderedSignature && input.context.identity.fullName) {
    const signature = normalizeClaimText(
      [
        "Best,",
        input.context.identity.fullName,
        input.context.identity.linkedinUrl,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (body.endsWith(` ${signature}`))
      body = body.slice(0, -signature.length).trimEnd();
  }
  validateAtomicOutput({
    claims: input.claims,
    sources: input.context.atomicSources ?? [],
    excludedClaims: input.context.excludedClaims ?? [],
    fields: [
      { text: input.subject, scope: "either" },
      { text: body, scope: "either" },
    ],
  });
}
