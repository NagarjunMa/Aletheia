import { z } from "zod";
import { LINKEDIN_CONNECTION_MAX_CHARACTERS } from "@/lib/ai/output-constraints";
import {
  atomicClaimsSchema,
  type AtomicClaim,
} from "@/modules/grounding/domain/atomic-claim";

export const COLD_EMAIL_MAX_PROOF_POINTS = 2;

const boundedSection = (maximum: number) =>
  z.string().trim().min(1).max(maximum);

export const coldEmailProofPointSchema = z
  .object({
    text: boundedSection(420),
    source_ids: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  })
  .strict();

/**
 * Server-only semantic composition from Claude. Candidate identity and the
 * final signature are intentionally absent: the renderer owns both.
 */
export const coldEmailDraftSchema = z
  .object({
    subject_line: boundedSection(160),
    greeting: boundedSection(80),
    target_opening: boundedSection(500),
    candidate_positioning: boundedSection(500),
    proof_points: z
      .array(coldEmailProofPointSchema)
      .max(COLD_EMAIL_MAX_PROOF_POINTS),
    value_statement: boundedSection(500),
    cta: boundedSection(300),
    claims: atomicClaimsSchema,
  })
  .strict();

export type ColdEmailProofPoint = z.infer<typeof coldEmailProofPointSchema>;
export type ColdEmailDraft = Omit<
  z.infer<typeof coldEmailDraftSchema>,
  "claims"
> & { claims?: AtomicClaim[] };

export { LINKEDIN_CONNECTION_MAX_CHARACTERS };

// Bound raw provider text before trimming; the final normalized envelope is
// independently checked by the renderer.
const connectionSection = z
  .string()
  .max(LINKEDIN_CONNECTION_MAX_CHARACTERS)
  .trim()
  .min(1);

const linkedinConnectionRelevanceSchema = z
  .object({
    text: connectionSection,
    source_ids: z.array(z.string().trim().min(1).max(120)).min(1).max(1),
  })
  .strict();

/**
 * Server-only semantic composition for a connection note. A null relevance
 * section is the explicit target-only fallback; it cannot imply candidate fit.
 * Raw sections share the final budget instead of fixed allocations. The renderer
 * enforces the combined sanitized length, including separating spaces.
 */
export const linkedinConnectionDraftSchema = z
  .object({
    target_observation: connectionSection,
    candidate_relevance: linkedinConnectionRelevanceSchema.nullable(),
    cta: connectionSection,
    claims: atomicClaimsSchema,
  })
  .strict();

export type LinkedinConnectionRelevance = z.infer<
  typeof linkedinConnectionRelevanceSchema
>;
export type LinkedinConnectionDraft = Omit<
  z.infer<typeof linkedinConnectionDraftSchema>,
  "claims"
> & { claims?: AtomicClaim[] };
