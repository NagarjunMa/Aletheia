import { z } from "zod";

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
  })
  .strict();

export type ColdEmailProofPoint = z.infer<typeof coldEmailProofPointSchema>;
export type ColdEmailDraft = z.infer<typeof coldEmailDraftSchema>;

export const LINKEDIN_CONNECTION_MAX_CHARACTERS = 300;

const linkedinConnectionRelevanceSchema = z
  .object({
    text: boundedSection(220),
    source_ids: z.array(z.string().trim().min(1).max(120)).min(1).max(1),
  })
  .strict();

/**
 * Server-only semantic composition for a connection note. A null relevance
 * section is the explicit target-only fallback; it cannot imply candidate fit.
 */
export const linkedinConnectionDraftSchema = z
  .object({
    target_observation: boundedSection(220),
    candidate_relevance: linkedinConnectionRelevanceSchema.nullable(),
    cta: boundedSection(140),
  })
  .strict();

export type LinkedinConnectionRelevance = z.infer<
  typeof linkedinConnectionRelevanceSchema
>;
export type LinkedinConnectionDraft = z.infer<
  typeof linkedinConnectionDraftSchema
>;
