import { z } from "zod";
import type { CandidateEvidenceInput } from "./schema";

export const CANDIDATE_FACT_KINDS = [
  "role",
  "company",
  "technology",
  "action",
  "outcome",
  "metric",
  "preference",
] as const;
export const MAX_REVIEWED_FACTS = 8;
export const candidateFactSchema = z
  .object({
    id: z.string().max(36).uuid(),
    kind: z.enum(CANDIDATE_FACT_KINDS),
    excerpt: z.string().max(600).trim().min(1),
    confirmed: z.literal(true),
  })
  .strict();
export const candidateFactsSchema = z
  .array(candidateFactSchema)
  .max(MAX_REVIEWED_FACTS)
  .refine(
    (facts) => new Set(facts.map((fact) => fact.id)).size === facts.length,
  )
  .refine(
    (facts) => new Set(facts.map((fact) => fact.excerpt)).size === facts.length,
  );
const reviewSchema = z
  .object({
    version: z.literal(1),
    source: z.string().max(24_000),
    facts: candidateFactsSchema,
  })
  .strict();
export type CandidateFact = z.infer<typeof candidateFactSchema>;
export type CandidateFactReview = z.infer<typeof reviewSchema>;

/** Fixed field order; binds qualifications and links as well as the quoted field. */
export function evidenceReviewSource(evidence: CandidateEvidenceInput): string {
  const { kind, title, context, actions, outcome, metrics, skills, links } =
    evidence;
  return JSON.stringify({
    kind,
    title,
    context,
    actions,
    outcome,
    metrics,
    skills,
    links,
  });
}

export function evidenceFactFields(evidence: CandidateEvidenceInput): string[] {
  return [
    evidence.title,
    evidence.context,
    evidence.actions,
    evidence.outcome,
    ...evidence.metrics,
    ...evidence.skills,
  ].filter(Boolean);
}

/** Suggestions are never trusted/typed/confirmed without the individual's review. */
export function suggestFactExcerpts(
  evidence: CandidateEvidenceInput,
): string[] {
  return [
    ...new Set(
      evidenceFactFields(evidence).flatMap((field) =>
        field.split(/(?<=[.!?])\s+(?=[A-Z])/u).map((part) => part.trim()),
      ),
    ),
  ]
    .filter((excerpt) => excerpt.length > 0 && excerpt.length <= 600)
    .slice(0, MAX_REVIEWED_FACTS);
}

export function prepareFactReview(
  evidence: CandidateEvidenceInput,
  input: unknown,
): CandidateFactReview {
  const parsed = candidateFactsSchema.safeParse(input);
  const source = evidenceReviewSource(evidence);
  if (
    !parsed.success ||
    source.length > 24_000 ||
    (parsed.data.length > 0 && !evidence.confirmed) ||
    (parsed.success &&
      parsed.data.some(
        (fact) =>
          !evidenceFactFields(evidence).some((field) =>
            field.includes(fact.excerpt),
          ),
      ))
  ) {
    throw new Error("Facts could not be verified");
  }
  return { version: 1, source, facts: parsed.data };
}

/** Malformed, old or stale private storage is never promoted to model evidence. */
export function readFactReview(
  evidence: CandidateEvidenceInput,
  input: unknown,
): CandidateFact[] {
  const parsed = reviewSchema.safeParse(input);
  if (
    !evidence.confirmed ||
    !parsed.success ||
    parsed.data.source !== evidenceReviewSource(evidence)
  )
    return [];
  try {
    return prepareFactReview(evidence, parsed.data.facts).facts;
  } catch {
    return [];
  }
}
