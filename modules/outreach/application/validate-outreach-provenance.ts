import type { OutputConstraint } from "@/lib/ai/output-constraints";
import { finalizeGroundedOutput } from "@/modules/grounding/application/finalize-grounded-output";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";
import { summarizeOutreachGrounding } from "../domain/outreach-grounding-metadata";
import type {
  FinalOutreachGroundingMetadata,
  OutreachGroundingContext,
} from "../domain/outreach-grounding.types";

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
}) {
  return finalizeGroundedOutput({
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

/** Project only candidate roots cited by the validated final output. */
export function summarizeValidatedOutreachGrounding(
  context: OutreachGroundingContext,
  usedSources: readonly AtomicSource[],
): FinalOutreachGroundingMetadata {
  const usedCandidateIds = new Set(
    usedSources
      .filter(({ scope }) => scope === "candidate")
      .map(({ id, rootId }) => rootId ?? id),
  );
  const usedKinds = context.sources
    .filter(({ id }) => usedCandidateIds.has(id))
    .map(({ type }) => type);
  return {
    ...summarizeOutreachGrounding(
      usedKinds,
      context.metadata.injectionSafeMode === true,
      context.sources.length > 0,
    ),
    provenanceValidated: true,
  };
}
