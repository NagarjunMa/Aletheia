import { z } from "zod";
import { isGroundedTextSafe } from "@/lib/ai/sanitizer";
import { scanForInjection } from "@/lib/ai/prompts/injection-heuristic";
import { MAX_RESUME_TEXT_LENGTH } from "@/lib/resumes/contracts";
import {
  candidateFactSchema,
  candidateFactsSchema,
  MAX_REVIEWED_FACTS,
  prepareFactReview,
  type CandidateFact,
} from "./fact-review";
import type { CandidateEvidenceRecord } from "./service";

const bullet = /^[ \t]*(?:[•●▪◦*–—-]|\d+[.)])[ \t]+/u;
const workStatement =
  /^(?:(?:i|we|my team|our team|the team)\s+)?(?:achieved|analy[sz]ed|assisted|automated|built|co-built|co-led|collaborated|contributed|created|decreased|delivered|deployed|designed|developed|enhanced|evaluated|fixed|helped|implemented|improved|increased|integrated|launched|led|maintained|managed|mentored|migrated|monitored|optim[izs]+ed|owned|partnered|reduced|released|resolved|reviewed|scaled|shipped|supported|tested|trained|used|validated|wrote)\b/iu;
const privateDetails =
  /(?:https?:\/\/|www\.|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|(?:\+?\d[ ().-]*){8,}|\b(?:home address|date of birth|passport number|social security|private key|api key|password)\b)/iu;
const documentHeading =
  /^(?:(?:(?:work|professional|relevant|technical)\s+)?(?:experience|employment|projects|education|certifications|training|skills|publications|awards|summary|contact):?|project\s*:\s*[^:\n]+)$/iu;
const explicitActor = /^(?:i|we|my team|our team|the team)\s+/iu;
const scopeWords = /\b(?:only|limited to|never|did not|was not|instead)\b/iu;

const reviewChoicesSchema = z
  .array(candidateFactSchema.pick({ kind: true, excerpt: true }))
  .max(MAX_REVIEWED_FACTS);
export const resumeReviewInputSchema = z
  .object({
    resumeId: z.uuid(),
    expectedRevision: z.string().max(64).datetime({ offset: true }),
    facts: reviewChoicesSchema,
  })
  .strict();
export type ResumeReviewChoice = z.infer<typeof reviewChoicesSchema>[number];

const normalizeExcerpt = (value: string) => value.replace(/\s+/gu, " ").trim();

function hasWorkStatement(excerpt: string) {
  return excerpt
    .split("\n")
    .some((line) => workStatement.test(line.replace(bullet, "").trim()));
}

function canReview(excerpt: string) {
  const normalized = excerpt.normalize("NFKC");
  return (
    excerpt.length >= 24 &&
    excerpt.length <= 600 &&
    hasWorkStatement(excerpt) &&
    !privateDetails.test(normalized) &&
    isGroundedTextSafe(normalized, "general") &&
    !scanForInjection(normalized).triggered
  );
}

function resumePassages(text: string) {
  if (text.length >= MAX_RESUME_TEXT_LENGTH) return [];
  const passages: Array<{ excerpt: string; containsWork: boolean }> = [];
  const blocks = text
    .replace(/\r\n?/gu, "\n")
    .split(/\n[ \t]*\n/u)
    .map((passage) => passage.trim())
    .filter(Boolean);
  for (const raw of blocks) {
    const previous = passages.at(-1);
    const marked = bullet.test(raw);
    const block = raw.replace(bullet, "").trim();
    const containsWork = hasWorkStatement(block);
    const opening = block.split("\n", 1)[0] ?? "";
    // Keep subjectless and qualified continuations with the previous passage.
    const independent =
      containsWork &&
      !marked &&
      explicitActor.test(opening) &&
      !scopeWords.test(opening.slice(0, 160));
    if (
      !independent &&
      previous?.containsWork &&
      !documentHeading.test(opening)
    ) {
      previous.excerpt += "\n" + block;
    } else if (
      containsWork &&
      previous &&
      !previous.containsWork &&
      !documentHeading.test(previous.excerpt)
    ) {
      previous.excerpt += "\n" + block;
      previous.containsWork = true;
    } else {
      passages.push({ excerpt: block, containsWork });
    }
  }
  const seen = new Set<string>();
  const suggestions: Array<{ excerpt: string; index: number; key: string }> =
    [];
  for (const [index, { excerpt, containsWork }] of passages.entries()) {
    if (!containsWork) continue;
    if (excerpt.length < 24 || excerpt.length > 600) continue;
    const key = normalizeExcerpt(excerpt);
    if (seen.has(key) || !canReview(excerpt)) continue;
    seen.add(key);
    suggestions.push({ excerpt, index, key });
    if (suggestions.length === MAX_REVIEWED_FACTS) break;
  }
  return suggestions;
}

export function suggestResumeFactExcerpts(text: string): string[] {
  return resumePassages(text).map(({ excerpt }) => excerpt);
}

function resumeReviewOptions(text: string) {
  const passages = resumePassages(text);
  const options = new Map<string, { excerpt: string; parts: string[] }>();
  for (const [position, { excerpt, index, key }] of passages.entries()) {
    options.set(key, { excerpt, parts: [key] });
    const next = passages[position + 1];
    if (next?.index !== index + 1) continue;
    const extended = excerpt + "\n" + next.excerpt;
    if (canReview(extended))
      options.set(normalizeExcerpt(extended), {
        excerpt: extended,
        parts: [key, next.key],
      });
  }
  return options;
}

function matchResumeChoices(text: string, choices: ResumeReviewChoice[]) {
  const options = resumeReviewOptions(text);
  const used = new Set<string>();
  const matched: ResumeReviewChoice[] = [];
  for (const { kind, excerpt } of choices) {
    const option = options.get(normalizeExcerpt(excerpt));
    if (!option || option.parts.some((part) => used.has(part))) return null;
    option.parts.forEach((part) => used.add(part));
    matched.push({ kind, excerpt: option.excerpt });
  }
  return matched;
}

export function readResumeFactReview(
  text: string,
  stored: unknown,
): CandidateFact[] {
  const parsed = candidateFactsSchema.safeParse(stored);
  if (!parsed.success || parsed.data.length === 0) return [];
  const matched = matchResumeChoices(text, parsed.data);
  if (
    !matched ||
    matched.some(
      (choice, index) => choice.excerpt !== parsed.data[index]?.excerpt,
    )
  )
    return [];
  return parsed.data;
}

export function prepareResumeFactReview(
  text: string,
  choices: ResumeReviewChoice[],
  stored: unknown,
): CandidateFact[] | null {
  const matched = matchResumeChoices(text, choices);
  if (!matched) return null;
  const existing = readResumeFactReview(text, stored);
  return matched.map(({ kind, excerpt }) => ({
    id:
      existing.find((fact) => fact.excerpt === excerpt)?.id ??
      crypto.randomUUID(),
    kind,
    excerpt,
    confirmed: true,
  }));
}

// Only YC projects these approvals into its existing exact-claim pipeline.
export function reviewedResumeEvidence(
  text: string,
  stored: unknown,
): CandidateEvidenceRecord[] {
  return readResumeFactReview(text, stored).map((fact) => {
    const evidence: CandidateEvidenceRecord = {
      id: "resume-" + fact.id,
      kind: "achievement",
      title: "Reviewed résumé fact",
      actions: fact.excerpt,
      context: "",
      outcome: "",
      metrics: [],
      skills: [],
      links: [],
      confirmed: true,
      sortOrder: 0,
    };
    return { ...evidence, factReview: prepareFactReview(evidence, [fact]) };
  });
}
