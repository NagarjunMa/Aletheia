import { deriveSafeCandidateSummary } from "@/lib/ai/candidate-summary";
import { escapeForXmlTag } from "@/lib/ai/prompts/linkedin-connection";
import { scanForInjection } from "@/lib/ai/prompts/injection-heuristic";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import type {
  CandidateGroundingData,
  CandidateGroundingSource,
} from "@/modules/candidate-context/domain/candidate-context.types";
import {
  OUTREACH_GROUNDING_BUDGETS,
  type OutreachGroundingContext,
  type OutreachGroundingInput,
} from "../domain/outreach-grounding.types";

const MIN_SOURCE_CHARS = 80;
const AI_TARGET_PATTERN =
  /\b(?:ai|artificial intelligence|llm|rag|agentic|agents?|machine learning|developer productivity|devtools?|sdlc|orchestration)\b/iu;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "who",
  "with",
  "you",
  "your",
]);

type DraftSource = CandidateGroundingSource & { rawContent: string };

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/gu, " ").trim())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function normalizeForMatching(value: string): string {
  return normalizeText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeForExclusion(value: string): string {
  return normalizeText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeForMatching(value)
      .split(" ")
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function truncateAtBoundary(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  const candidate = value.slice(0, maximum);
  const boundary = Math.max(
    candidate.lastIndexOf("\n"),
    candidate.lastIndexOf(" "),
  );
  return (
    boundary >= MIN_SOURCE_CHARS ? candidate.slice(0, boundary) : candidate
  ).trim();
}

function excludedClaims(values: string[]): string[] {
  return [...new Set(values.map(normalizeForExclusion).filter(Boolean))];
}

function containsExcludedClaim(value: string, claims: string[]): boolean {
  const searchable = ` ${normalizeForExclusion(value)} `;
  return claims.some((claim) => searchable.includes(` ${claim} `));
}

function overlapScore(value: string, targetTokens: Set<string>): number {
  let score = 0;
  for (const token of tokenize(value)) if (targetTokens.has(token)) score += 1;
  return score;
}

function renderEvidence(entry: CandidateEvidenceRecord): string {
  return [
    `Title: ${normalizeText(entry.title)}`,
    entry.skills.length
      ? `Skills: ${entry.skills.map(normalizeText).join(", ")}`
      : "",
    entry.context ? `Context: ${normalizeText(entry.context)}` : "",
    `Actions: ${normalizeText(entry.actions)}`,
    entry.outcome ? `Outcome: ${normalizeText(entry.outcome)}` : "",
    entry.metrics.length
      ? `Metrics: ${entry.metrics.map(normalizeText).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function rankedEvidence(
  evidence: CandidateEvidenceRecord[],
  target: string,
): CandidateEvidenceRecord[] {
  const targetTokens = tokenize(target);
  const targetIsAi = AI_TARGET_PATTERN.test(target);
  return [...evidence].sort((left, right) => {
    const score = (entry: CandidateEvidenceRecord) =>
      overlapScore(`${entry.title} ${entry.skills.join(" ")}`, targetTokens) *
        4 +
      overlapScore(
        `${entry.outcome} ${entry.metrics.join(" ")}`,
        targetTokens,
      ) *
        3 +
      overlapScore(entry.actions, targetTokens) * 2 +
      overlapScore(entry.context, targetTokens) +
      (targetIsAi && entry.kind === "ai_usage" ? 100 : 0);
    return (
      score(right) - score(left) ||
      left.sortOrder - right.sortOrder ||
      left.id.localeCompare(right.id)
    );
  });
}

function profileDrafts(candidate: CandidateGroundingData): DraftSource[] {
  const profile = candidate.profile;
  const fields: Array<[string, string, string]> = [
    ["profile.current_role", "Current role", profile.currentRole],
    [
      "profile.current_responsibilities",
      "Current responsibilities",
      profile.currentResponsibilities,
    ],
    [
      "profile.startup_motivation",
      "Startup motivation",
      profile.startupMotivation,
    ],
    ["profile.career_goals", "Career goals", profile.careerGoals],
    ["profile.target_roles", "Target roles", profile.targetRoles.join(", ")],
    [
      "profile.target_industries",
      "Target industries",
      profile.targetIndustries.join(", "),
    ],
  ];
  return fields
    .map(([id, label, rawContent]) => ({
      id,
      label,
      rawContent: normalizeText(rawContent),
      content: normalizeText(rawContent),
      type: "profile" as const,
      priority: 2 as const,
    }))
    .filter((source) => Boolean(source.rawContent));
}

function safeSummaryDraft(candidate: CandidateGroundingData): DraftSource[] {
  const summary = deriveSafeCandidateSummary(
    normalizeText(candidate.resume.text),
  );
  return summary
    ? [
        {
          id: "resume.safe_summary",
          label: "High-level candidate summary",
          rawContent: summary,
          content: summary,
          type: "resume" as const,
          priority: 3 as const,
        },
      ]
    : [];
}

function applyBudget(
  drafts: DraftSource[],
  input: OutreachGroundingInput,
  claims: string[],
): CandidateGroundingSource[] {
  const budget = OUTREACH_GROUNDING_BUDGETS[input.category];
  const result: CandidateGroundingSource[] = [];
  const seen = new Set<string>();
  let remaining = budget.maxTotalChars;
  let evidenceCount = 0;
  for (const draft of drafts) {
    if (containsExcludedClaim(draft.rawContent, claims)) continue;
    if (draft.type === "evidence" && evidenceCount >= budget.maxEvidence)
      continue;
    const content = truncateAtBoundary(
      escapeForXmlTag(draft.content),
      Math.min(budget.maxSourceChars, remaining),
    );
    const signature = normalizeForMatching(content);
    if (!content || !signature || seen.has(signature)) continue;
    seen.add(signature);
    result.push({
      ...draft,
      label: escapeForXmlTag(normalizeText(draft.label)),
      content,
    });
    remaining -= content.length;
    if (draft.type === "evidence") evidenceCount += 1;
    if (remaining < MIN_SOURCE_CHARS) break;
  }
  return result;
}

/**
 * Produces deterministic, bounded server-only context. This function neither
 * performs I/O nor logs data, which keeps it safe to exercise with synthetic
 * fixtures and lets callers decide how (or whether) to use the sources.
 */
export function buildOutreachGroundingContext(input: {
  target: OutreachGroundingInput;
  candidate: CandidateGroundingData;
}): OutreachGroundingContext {
  const target = {
    ...input.target,
    profileMarkdown: normalizeText(input.target.profileMarkdown),
    jobDescription: normalizeText(input.target.jobDescription),
    conversationContext: normalizeText(input.target.conversationContext),
  };
  const claims = excludedClaims(input.candidate.profile.excludedClaims);
  const injectionSafeMode = scanForInjection(target.profileMarkdown).triggered;
  let drafts: DraftSource[];

  if (injectionSafeMode) {
    drafts = safeSummaryDraft(input.candidate);
  } else {
    const evidence = rankedEvidence(
      input.candidate.confirmedEvidence.filter(
        (entry) =>
          entry.confirmed &&
          !containsExcludedClaim(renderEvidence(entry), claims),
      ),
      `${target.profileMarkdown} ${target.jobDescription} ${target.conversationContext}`,
    ).map((entry) => ({
      id: `evidence:${entry.id}`,
      label: entry.title,
      content: renderEvidence(entry),
      rawContent: renderEvidence(entry),
      type: "evidence" as const,
      priority: 1 as const,
    }));
    const resume = normalizeText(input.candidate.resume.text);
    drafts = [
      ...evidence,
      ...profileDrafts(input.candidate),
      ...(resume
        ? [
            {
              id: "resume.primary",
              label: "Primary resume",
              content: resume,
              rawContent: resume,
              type: "resume" as const,
              priority: 3 as const,
            },
          ]
        : []),
    ];
  }

  const sources = applyBudget(drafts, target, claims);
  const evidenceCount = sources.filter(
    (source) => source.type === "evidence",
  ).length;
  const profileCount = sources.filter(
    (source) => source.type === "profile",
  ).length;
  const resumeCount = sources.filter(
    (source) => source.type === "resume",
  ).length;
  const groundingLevel = evidenceCount
    ? "verified_evidence"
    : profileCount
      ? "profile_grounded"
      : resumeCount
        ? "resume_fallback"
        : "target_only";
  const fallbackReason = injectionSafeMode
    ? "target_injection_detected"
    : evidenceCount
      ? "none"
      : profileCount
        ? "no_confirmed_evidence"
        : resumeCount
          ? "no_profile_context"
          : "no_resume_context";

  return {
    identity: input.candidate.identity,
    sources,
    metadata: {
      groundingLevel,
      fallbackReason,
      selectedSourceCount: sources.length,
      selectedEvidenceCount: evidenceCount,
      selectedSourceKinds: [...new Set(sources.map((source) => source.type))],
      injectionSafeMode,
    },
  };
}
