import {
  assertSafeSelectionText,
  budgetReviewedStory,
  includesSelectedEvidence,
  prepareSelectedStoryFacts,
  resolveSelectedEvidence,
  SelectedEvidenceUnavailableError,
} from "@/modules/candidate-context/application/selected-evidence";
import {
  normalizeClaimText,
  isFirstPersonAssertion,
} from "@/modules/grounding/domain/atomic-claim";
import type { EvidenceSelectionDiagnostics } from "@/modules/candidate-context/domain/candidate-context.types";
import {
  normalizeForExclusion,
  containsExcludedClaim,
} from "@/modules/grounding/domain/excluded-claims";
import { createEvidenceRanker } from "@/modules/candidate-context/application/rank-evidence";
import { deriveSafeCandidateSummary } from "@/lib/ai/candidate-summary";
import {
  buildAtomicCandidateSources,
  buildAtomicTargetSources,
  normalizeAtomicSourceText,
} from "@/modules/grounding/application/build-atomic-sources";
import { escapeForXmlTag } from "@/lib/ai/prompts/linkedin-connection";
import { scanForInjection } from "@/lib/ai/prompts/injection-heuristic";
import { readFactReview } from "@/lib/candidate-profile/fact-review";
import {
  MAX_SUPPORTING_EXCERPT,
  type AtomicSource,
} from "@/modules/grounding/domain/atomic-claim";
import {
  linkedinCandidateFits,
  createLinkedinTargetMatcher,
  linkedinTargetFits,
} from "../domain/linkedin-grounded-selection";
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
type DraftSource = CandidateGroundingSource & { rawContent: string };

function normalizeText(value: string): string {
  return normalizeClaimText(value);
}

function normalizeForMatching(value: string): string {
  return normalizeText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
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

function reviewedLinkedinEvidence(
  entry: CandidateEvidenceRecord,
  targets: readonly AtomicSource[],
): string {
  const parts: string[] = [];
  let remaining = OUTREACH_GROUNDING_BUDGETS.linkedin_connection.maxSourceChars;
  for (const fact of readFactReview(entry, entry.factReview)) {
    const content = normalizeAtomicSourceText(fact.excerpt);
    const source: AtomicSource = {
      id: `evidence:${entry.id}.fact.${fact.id}`,
      scope: "candidate",
      kind: fact.kind,
      content,
    };
    const size = content.length + (parts.length ? 1 : 0);
    if (
      content.length > MAX_SUPPORTING_EXCERPT ||
      size > remaining ||
      !linkedinCandidateFits(source, targets)
    )
      continue;
    parts.push(content);
    remaining -= size;
  }
  return parts.join("\n");
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
  distinctStories: boolean,
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
    const key =
      distinctStories && draft.type === "evidence" ? draft.id : signature;
    if (!content || !signature || seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: draft.id,
      type: draft.type,
      priority: draft.priority,
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
  selectedEvidenceIds?: readonly string[];
}): OutreachGroundingContext {
  const target = {
    ...input.target,
    profileMarkdown: normalizeText(input.target.profileMarkdown),
    jobDescription: normalizeText(input.target.jobDescription),
    conversationContext: normalizeText(input.target.conversationContext),
  };
  if (input.selectedEvidenceIds?.length) {
    assertSafeSelectionText(
      [
        target.profileMarkdown,
        target.jobDescription,
        target.conversationContext,
      ].join("\n"),
    );
  }
  const claims = excludedClaims(input.candidate.profile.excludedClaims);
  const injectionScan = scanForInjection(target.profileMarkdown);
  const injectionSafeMode = injectionScan.triggered;
  const allowedEvidence = injectionSafeMode
    ? []
    : input.candidate.confirmedEvidence.filter(
        (entry) =>
          entry.confirmed &&
          !containsExcludedClaim(renderEvidence(entry), claims),
      );
  const explicit = input.selectedEvidenceIds?.length
    ? resolveSelectedEvidence(
        input.selectedEvidenceIds,
        allowedEvidence,
        OUTREACH_GROUNDING_BUDGETS[target.category].maxEvidence,
        claims,
      )
    : undefined;
  const requiredEvidenceRoots = explicit?.map(
    (entry) => `evidence:${entry.id}`,
  );
  const selection =
    injectionSafeMode || explicit
      ? undefined
      : createEvidenceRanker(
          allowedEvidence,
          target.category === "linkedin_connection"
            ? (entry) =>
                readFactReview(entry, entry.factReview)
                  .map((fact) => fact.excerpt)
                  .join("\n")
            : undefined,
        )({
          primary:
            target.jobDescription ||
            target.conversationContext ||
            target.profileMarkdown,
          secondary: `${target.profileMarkdown} ${target.conversationContext}`,
        });
  const selectedEvidence = explicit ?? selection?.evidence ?? [];
  let preferredEvidenceId: string | undefined;
  const targets = buildAtomicTargetSources(
    injectionSafeMode
      ? {}
      : {
          profile: target.profileMarkdown,
          jobDescription: target.jobDescription,
          conversation: target.conversationContext,
        },
    input.candidate.profile.excludedClaims,
    target.category === "linkedin_connection" ? linkedinTargetFits : undefined,
    target.category === "linkedin_connection"
      ? "linkedin_connection"
      : undefined,
    target.category === "linkedin_connection"
      ? (pool) => {
          const matchTargets = createLinkedinTargetMatcher(pool);
          let fallback:
            { entryId: string; targets: AtomicSource[] } | undefined;
          for (const entry of selectedEvidence) {
            const matched = new Map<string, AtomicSource>();
            for (const fact of readFactReview(entry, entry.factReview)) {
              const content = normalizeAtomicSourceText(fact.excerpt);
              if (!isFirstPersonAssertion(content)) continue;
              for (const source of matchTargets({
                id: fact.id,
                scope: "candidate",
                kind: fact.kind,
                content,
              }))
                matched.set(source.id, source);
            }
            const ordered = [...matched.values()].sort(
              (a, b) =>
                Number(b.rewrite === "linkedin_job_interest") -
                Number(a.rewrite === "linkedin_job_interest"),
            );
            if (!ordered.length) continue;
            const result = { entryId: entry.id, targets: ordered };
            if (ordered[0]!.rewrite === "linkedin_job_interest") {
              fallback = result;
              break;
            }
            fallback ??= result;
          }
          if (!fallback) return pool;
          preferredEvidenceId = fallback.entryId;
          const selected = new Set(fallback.targets.map((source) => source.id));
          return [
            ...fallback.targets,
            ...pool.filter((source) => !selected.has(source.id)),
          ];
        }
      : undefined,
  );
  let drafts: DraftSource[];
  let selectionDiagnostics: EvidenceSelectionDiagnostics | undefined;

  if (injectionSafeMode) {
    drafts = safeSummaryDraft(input.candidate);
  } else {
    selectionDiagnostics = selection?.diagnostics;
    const evidence = [...selectedEvidence]
      .sort(
        (a, b) =>
          Number(b.id === preferredEvidenceId) -
          Number(a.id === preferredEvidenceId),
      )
      .map((entry) => ({
        id: `evidence:${entry.id}`,
        label: entry.title,
        content:
          target.category === "linkedin_connection"
            ? reviewedLinkedinEvidence(entry, targets.sources)
            : explicit
              ? budgetReviewedStory(
                  entry,
                  target.category === "cold_email" ? "email" : "linkedin",
                  OUTREACH_GROUNDING_BUDGETS[target.category].maxSourceChars,
                )
              : renderEvidence(entry),
        rawContent: renderEvidence(entry),
        type: "evidence" as const,
        priority: 1 as const,
      }))
      .filter((source) => Boolean(source.content));
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

  const budgetedSources = applyBudget(
    drafts,
    target,
    claims,
    Boolean(explicit),
  );
  const candidateAtoms = buildAtomicCandidateSources(
    input.candidate,
    budgetedSources,
  ).filter(
    (source) =>
      target.category !== "linkedin_connection" ||
      linkedinCandidateFits(source, targets.sources),
  );
  const prepared = requiredEvidenceRoots
    ? prepareSelectedStoryFacts(
        budgetedSources,
        candidateAtoms,
        target.category === "cold_email" ? "email" : "linkedin",
      )
    : { sources: budgetedSources, safeAtoms: candidateAtoms };
  const { sources } = prepared;
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

  const atomicSources = [...prepared.safeAtoms, ...targets.sources];
  if (
    requiredEvidenceRoots &&
    !includesSelectedEvidence(
      requiredEvidenceRoots,
      atomicSources.map((source) => source.rootId),
    )
  )
    throw new SelectedEvidenceUnavailableError();

  return {
    identity: input.candidate.identity,
    ...(selectionDiagnostics ? { selectionDiagnostics } : {}),
    ...(requiredEvidenceRoots ? { requiredEvidenceRoots } : {}),
    sources,
    atomicSources,
    targetDiagnostics: {
      ...targets.diagnostics,
      injectionReasons: injectionScan.reasons,
    },
    excludedClaims: input.candidate.profile.excludedClaims,
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
