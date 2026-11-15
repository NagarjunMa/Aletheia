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

export function evidenceFactSources(evidence: CandidateEvidenceInput): Array<{
  text: string;
  field: string;
  kind: CandidateFact["kind"];
  demonstrates: string;
}> {
  const sources: ReturnType<typeof evidenceFactSources> = [
    {
      text: evidence.actions,
      field: "Actions",
      kind: "action",
      demonstrates: "Work performed, decisions or implementation.",
    },
    {
      text: evidence.outcome,
      field: "Outcome",
      kind: "outcome",
      demonstrates: "What happened after the work.",
    },
    ...evidence.metrics.map((text) => ({
      text,
      field: "Metrics",
      kind: "metric" as const,
      demonstrates: "A recorded measurement or comparison.",
    })),
    {
      text: evidence.context,
      field: "Context",
      kind: "action",
      demonstrates: "The problem, constraints or reason for the work.",
    },
    {
      text: evidence.title,
      field: "Title",
      kind: "action",
      demonstrates: "Which project the fact belongs to.",
    },
    ...evidence.skills.map((text) => ({
      text,
      field: "Skills",
      kind: "technology" as const,
      demonstrates: "A skill or tool named in the project.",
    })),
  ];
  return sources.filter(({ text }) => Boolean(text));
}

export function evidenceFactFields(evidence: CandidateEvidenceInput): string[] {
  return evidenceFactSources(evidence).map(({ text }) => text);
}

/** Bind new approvals to a whole entry, including qualifications on later lines. */
export function findCompleteFactSource(
  sources: ReturnType<typeof evidenceFactSources>,
  excerpt: string,
) {
  return sources.find(({ text }) => text === excerpt);
}

/** Suggestions use whole saved fields when they fit the fact limit. */
export function suggestFactExcerpts(
  evidence: CandidateEvidenceInput,
): string[] {
  return [
    ...new Set(
      evidenceFactSources(evidence)
        .filter(({ field }) => field !== "Title" && field !== "Skills")
        .map(({ text }) => text),
    ),
  ]
    .filter((excerpt) => excerpt.length <= 600)
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
