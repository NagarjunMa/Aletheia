import { escapeForXmlTag } from "@/lib/ai/prompts/linkedin-connection";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import type {
  CandidateGroundingData,
  YcGroundingContext,
  YcGroundingReadiness,
  YcGroundingSource,
} from "../domain/yc-grounding.types";

export const YC_GROUNDING_MAX_EVIDENCE = 6;
export const YC_GROUNDING_MAX_SOURCE_CHARS = 16_000;
const MAX_EVIDENCE_SOURCE_CHARS = 2_500;
const MAX_PROFILE_SOURCE_CHARS = 1_500;
const MAX_RESUME_SOURCE_CHARS = 6_000;
const MIN_TRUNCATED_SOURCE_CHARS = 80;

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

type DraftSource = YcGroundingSource & {
  rawContent: string;
};

type RankedEvidence = {
  evidence: CandidateEvidenceRecord;
  score: number;
};

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

function normalizeExcludedClaims(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    const signature = normalizeForExclusion(normalized);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    result.push(normalized);
  }
  return result;
}

function containsExcludedClaim(
  value: string,
  excludedClaims: string[],
): boolean {
  const searchable = ` ${normalizeForExclusion(value)} `;
  return excludedClaims.some((claim) => {
    const normalizedClaim = normalizeForExclusion(claim);
    return (
      normalizedClaim.length > 0 && searchable.includes(` ${normalizedClaim} `)
    );
  });
}

function overlapScore(value: string, targetTokens: Set<string>): number {
  let score = 0;
  for (const token of tokenize(value)) {
    if (targetTokens.has(token)) score += 1;
  }
  return score;
}

function evidenceScore(
  evidence: CandidateEvidenceRecord,
  targetTokens: Set<string>,
): number {
  return (
    overlapScore(
      `${evidence.title} ${evidence.skills.join(" ")}`,
      targetTokens,
    ) *
      4 +
    overlapScore(
      `${evidence.outcome} ${evidence.metrics.join(" ")}`,
      targetTokens,
    ) *
      3 +
    overlapScore(evidence.actions, targetTokens) * 2 +
    overlapScore(evidence.context, targetTokens)
  );
}

function rankEvidence(
  evidence: CandidateEvidenceRecord[],
  question: string,
  jobDescription: string,
): CandidateEvidenceRecord[] {
  const targetTokens = tokenize(`${question} ${jobDescription}`);
  const ranked: RankedEvidence[] = evidence.map((entry) => ({
    evidence: entry,
    score: evidenceScore(entry, targetTokens),
  }));

  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      left.evidence.sortOrder - right.evidence.sortOrder ||
      left.evidence.id.localeCompare(right.evidence.id),
  );

  if (ranked.every((entry) => entry.score === 0)) {
    return ranked.slice(0, 2).map((entry) => entry.evidence);
  }
  return ranked
    .slice(0, YC_GROUNDING_MAX_EVIDENCE)
    .map((entry) => entry.evidence);
}

function truncateAtBoundary(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  const candidate = value.slice(0, maximum);
  const boundary = Math.max(
    candidate.lastIndexOf("\n"),
    candidate.lastIndexOf(" "),
  );
  return (
    boundary >= MIN_TRUNCATED_SOURCE_CHARS
      ? candidate.slice(0, boundary)
      : candidate
  ).trim();
}

function renderEvidence(entry: CandidateEvidenceRecord): string {
  const parts = [
    `Title: ${normalizeText(entry.title)}`,
    entry.skills.length > 0
      ? `Skills: ${entry.skills.map(normalizeText).join(", ")}`
      : "",
    entry.context ? `Context: ${normalizeText(entry.context)}` : "",
    `Actions: ${normalizeText(entry.actions)}`,
    entry.outcome ? `Outcome: ${normalizeText(entry.outcome)}` : "",
    entry.metrics.length > 0
      ? `Metrics: ${entry.metrics.map(normalizeText).join(", ")}`
      : "",
  ].filter(Boolean);
  return truncateAtBoundary(parts.join("\n"), MAX_EVIDENCE_SOURCE_CHARS);
}

function profileDraftSources(candidate: CandidateGroundingData): DraftSource[] {
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
      "profile.target_company_stages",
      "Target company stages",
      profile.targetCompanyStages.join(", "),
    ],
    [
      "profile.target_industries",
      "Target industries",
      profile.targetIndustries.join(", "),
    ],
    ["profile.location", "Location", profile.location],
    [
      "profile.work_authorization",
      "Work authorization",
      profile.workAuthorization,
    ],
    ["profile.availability", "Availability", profile.availability],
    ["profile.github_url", "GitHub", profile.githubUrl],
    ["profile.linkedin_url", "LinkedIn", profile.linkedinUrl],
    ["profile.portfolio_url", "Portfolio", profile.portfolioUrl],
  ];

  return fields
    .map(([id, label, rawContent]) => ({
      id,
      label,
      rawContent: normalizeText(rawContent),
      content: truncateAtBoundary(
        normalizeText(rawContent),
        MAX_PROFILE_SOURCE_CHARS,
      ),
      type: "profile" as const,
      priority: 2 as const,
    }))
    .filter((source) => source.rawContent.length > 0);
}

function applySafetyAndBudget(
  drafts: DraftSource[],
  excludedClaims: string[],
): YcGroundingSource[] {
  const result: YcGroundingSource[] = [];
  const seen = new Set<string>();
  let remaining = YC_GROUNDING_MAX_SOURCE_CHARS;

  for (const draft of drafts) {
    if (containsExcludedClaim(draft.rawContent, excludedClaims)) continue;
    const escapedContent = escapeForXmlTag(draft.content);
    const bounded = truncateAtBoundary(escapedContent, remaining);
    if (
      !bounded ||
      (bounded.length < escapedContent.length &&
        bounded.length < MIN_TRUNCATED_SOURCE_CHARS)
    ) {
      continue;
    }
    const signature = normalizeForMatching(bounded);
    if (!signature || seen.has(signature)) continue;

    seen.add(signature);
    result.push({
      id: draft.id,
      type: draft.type,
      label: escapeForXmlTag(normalizeText(draft.label)),
      content: bounded,
      priority: draft.priority,
    });
    remaining -= bounded.length;
    if (remaining < MIN_TRUNCATED_SOURCE_CHARS) break;
  }

  return result;
}

function buildReadiness(
  sources: YcGroundingSource[],
  candidate: CandidateGroundingData,
  selectedEvidence: CandidateEvidenceRecord[],
): YcGroundingReadiness {
  const sourceIds = new Set(sources.map((source) => source.id));
  const hasBackground =
    sourceIds.has("profile.current_role") || sourceIds.has("resume.primary");
  const hasEvidence = sources.some((source) => source.type === "evidence");
  const missingFields: YcGroundingReadiness["missingFields"] = [];
  if (!hasBackground) missingFields.push("current_role_or_resume");
  if (!hasEvidence) missingFields.push("confirmed_evidence");

  const recommendedFields: string[] = [];
  if (!candidate.profile.currentResponsibilities) {
    recommendedFields.push("current_responsibilities");
  }
  if (!selectedEvidence.some((entry) => entry.kind === "technical_project")) {
    recommendedFields.push("technical_project_evidence");
  }
  if (!candidate.profile.startupMotivation) {
    recommendedFields.push("startup_motivation");
  }
  if (!selectedEvidence.some((entry) => entry.kind === "ai_usage")) {
    recommendedFields.push("ai_usage_evidence");
  }

  return {
    ready: missingFields.length === 0,
    missingFields,
    recommendedFields,
  };
}

export function buildYcGroundingContext(input: {
  question: string;
  jobDescription: string;
  candidate: CandidateGroundingData;
}): YcGroundingContext {
  const normalizedQuestion = normalizeText(input.question);
  const normalizedJobDescription = normalizeText(input.jobDescription);
  const excludedClaims = normalizeExcludedClaims(
    input.candidate.profile.excludedClaims,
  );

  const allowedEvidence = input.candidate.confirmedEvidence.filter(
    (entry) =>
      entry.confirmed &&
      !containsExcludedClaim(
        [
          entry.title,
          entry.context,
          entry.actions,
          entry.outcome,
          ...entry.metrics,
          ...entry.skills,
        ].join(" "),
        excludedClaims,
      ),
  );
  const selectedEvidence = rankEvidence(
    allowedEvidence,
    normalizedQuestion,
    normalizedJobDescription,
  );

  const evidenceDrafts: DraftSource[] = selectedEvidence.map((entry) => ({
    id: `evidence:${entry.id}`,
    type: "evidence",
    label: entry.title,
    content: renderEvidence(entry),
    rawContent: [
      entry.title,
      entry.context,
      entry.actions,
      entry.outcome,
      ...entry.metrics,
      ...entry.skills,
    ].join(" "),
    priority: 1,
  }));
  const resumeText = normalizeText(input.candidate.resume.text);
  const resumeDrafts: DraftSource[] = resumeText
    ? [
        {
          id: "resume.primary",
          type: "resume",
          label: "Primary resume",
          content: truncateAtBoundary(resumeText, MAX_RESUME_SOURCE_CHARS),
          rawContent: resumeText,
          priority: 3,
        },
      ]
    : [];

  const sources = applySafetyAndBudget(
    [
      ...evidenceDrafts,
      ...profileDraftSources(input.candidate),
      ...resumeDrafts,
    ],
    excludedClaims,
  );
  const readiness = buildReadiness(sources, input.candidate, selectedEvidence);
  const profileFieldCount = sources.filter(
    (source) => source.type === "profile",
  ).length;
  const confirmedEvidenceCount = sources.filter(
    (source) => source.type === "evidence",
  ).length;
  const resumeSource = sources.some((source) => source.id === "resume.primary")
    ? input.candidate.resume.source
    : "none";

  return {
    question: escapeForXmlTag(normalizedQuestion),
    jobDescription: escapeForXmlTag(normalizedJobDescription),
    sources,
    excludedClaims: excludedClaims.map(escapeForXmlTag),
    readiness,
    metadata: {
      profileFieldCount,
      confirmedEvidenceCount,
      resumeSource,
    },
  };
}
