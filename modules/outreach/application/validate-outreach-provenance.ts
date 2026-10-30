import type { OutputConstraint } from "@/lib/ai/output-constraints";
import { finalizeGroundedOutput } from "@/modules/grounding/application/finalize-grounded-output";
import type { OutreachGroundingContext } from "../domain/outreach-grounding.types";

/** The shared boundary covers exact displayed fields, including trusted identity structure. */
export function validateOutreachProvenance(input: {
  body: string;
  bodyConstraint: OutputConstraint;
  requiredEnding?: string;
  subject: string;
  claims: unknown;
  context: OutreachGroundingContext;
  renderedSignature?: boolean;
  platform?: "email" | "linkedin";
}): void {
  finalizeGroundedOutput({
    body: input.body,
    bodyConstraint: input.bodyConstraint,
    ...(input.requiredEnding ? { requiredEnding: input.requiredEnding } : {}),
    subject: input.subject,
    claims: input.claims,
    sources: input.context.atomicSources ?? [],
    excludedClaims: input.context.excludedClaims ?? [],
    platform: input.platform ?? "email",
    ...(input.renderedSignature
      ? { trustedIdentity: input.context.identity }
      : {}),
  });
}
