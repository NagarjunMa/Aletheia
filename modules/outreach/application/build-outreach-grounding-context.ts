import {
  assertSafeSelectionText,
  budgetReviewedStory,
  includesSelectedEvidence,
  prepareReviewedStoryFacts,
  prepareSelectedStoryFacts,
  resolveSelectedEvidence,
  reviewedStoryText,
  SelectedEvidenceUnavailableError,
} from "@/modules/candidate-context/application/selected-evidence";
import { normalizeClaimText } from "@/modules/grounding/domain/atomic-claim";
import {
  normalizeForExclusion,
  containsExcludedClaim,
} from "@/modules/grounding/domain/excluded-claims";
import {
  createEvidenceRanker,
  createReviewedFactMatcher,
} from "@/modules/candidate-context/application/rank-evidence";
import { deriveSafeCandidateSummary } from "@/lib/ai/candidate-summary";
import {
  buildAtomicCandidateSources,
  buildAtomicTargetSources,
  candidateEvidenceFactId,
  normalizeAtomicSourceText,
} from "@/modules/grounding/application/build-atomic-sources";
import { escapeForXmlTag } from "@/lib/ai/prompts/linkedin-connection";
import { isGroundedTextSafe } from "@/lib/ai/sanitizer";
import { scanForInjection } from "@/lib/ai/prompts/injection-heuristic";
import {
  readFactReview,
  type CandidateFact,
} from "@/lib/candidate-profile/fact-review";
import {
  linkedinTargetHasContradiction,
  MAX_SUPPORTING_EXCERPT,
  type AtomicSource,
} from "@/modules/grounding/domain/atomic-claim";
import {
  linkedinCandidateFits,
  createLinkedinTargetMatcher,
  isLinkedinExperience,
  isLinkedinJobTarget,
  linkedinTargetFits,
  linkedinTargetWording,
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

const REVIEWED_FRAGMENT_BOUNDARY = /[.!?;,:\p{Pd}\s]/u;

function containsReviewedFragment(full: string, fragment: string): boolean {
  if (!fragment || full.length <= fragment.length) return false;
  let start = full.indexOf(fragment);
  while (start >= 0) {
    const end = start + fragment.length;
    const before = full[start - 1];
    const after = full[end];
    if (
      (!before || REVIEWED_FRAGMENT_BOUNDARY.test(before)) &&
      (!after || REVIEWED_FRAGMENT_BOUNDARY.test(after)) &&
      /[\p{L}\p{N}]/u.test(full.slice(0, start) + full.slice(end))
    )
      return true;
    start = full.indexOf(fragment, start + 1);
  }
  return false;
}

function completeLinkedinFacts(
  entry: CandidateEvidenceRecord,
): CandidateFact[] {
  const facts = readFactReview(entry, entry.factReview);
  // A longer owner-reviewed excerpt can qualify the whole shorter assertion.
  return facts.filter(({ excerpt }) => {
    const fragment = normalizeClaimText(excerpt).replace(/[.!?]$/u, "");
    return !facts.some((other) =>
      containsReviewedFragment(normalizeClaimText(other.excerpt), fragment),
    );
  });
}

function reviewedLinkedinEvidence(
  entryId: string,
  facts: readonly CandidateFact[],
  targets: readonly AtomicSource[],
  limit: OutreachGroundingInput["connectionNoteLimit"],
): string {
  const parts: string[] = [];
  let remaining = OUTREACH_GROUNDING_BUDGETS.linkedin_connection.maxSourceChars;
  for (const fact of facts) {
    const content = normalizeAtomicSourceText(fact.excerpt);
    const source: AtomicSource = {
      id: `evidence:${entryId}.fact.${fact.id}`,
      scope: "candidate",
      kind: fact.kind,
      content,
    };
    const size = content.length + (parts.length ? 1 : 0);
    if (
      content.length > MAX_SUPPORTING_EXCERPT ||
      size > remaining ||
      !linkedinCandidateFits(source, targets, limit)
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
  const linkedin = target.category === "linkedin_connection";
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
  const injectionScan = scanForInjection(
    linkedin
      ? [
          target.profileMarkdown,
          target.jobDescription,
          target.conversationContext,
        ].join("\n\n")
      : target.profileMarkdown,
  );
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
  const reviewedEvidence =
    !explicit && !injectionSafeMode && !linkedin
      ? prepareReviewedStoryFacts(
          allowedEvidence,
          target.category === "cold_email" ? "email" : "linkedin",
          OUTREACH_GROUNDING_BUDGETS[target.category].maxSourceChars,
        )
      : undefined;
  const relevanceTarget = {
    primary:
      target.jobDescription ||
      target.conversationContext ||
      target.profileMarkdown,
    secondary: `${target.profileMarkdown} ${target.conversationContext}`,
  };
  const selection =
    injectionSafeMode || explicit || linkedin
      ? undefined
      : createEvidenceRanker(allowedEvidence, (entry) =>
          (reviewedEvidence?.get(entry.id) ?? []).map(({ excerpt }) => excerpt),
        )(relevanceTarget);
  let selectedEvidence = explicit ?? selection?.evidence ?? [];
  let winningLinkedinFact:
    { entryId: string; fact: CandidateFact; content: string } | undefined;
  let selectionDiagnostics = selection?.diagnostics;
  const linkedinFacts =
    linkedin && !injectionSafeMode
      ? new Map(
          (explicit ?? allowedEvidence).map((entry) => [
            entry.id,
            completeLinkedinFacts(entry),
          ]),
        )
      : undefined;
  const targets = buildAtomicTargetSources(
    injectionSafeMode
      ? {}
      : {
          profile: target.profileMarkdown,
          jobDescription: target.jobDescription,
          conversation: target.conversationContext,
        },
    input.candidate.profile.excludedClaims,
    target.category === "linkedin_connection"
      ? (source) => {
          if (!linkedinTargetFits(source, target.connectionNoteLimit))
            return "overlength";
          const text = linkedinTargetWording(source);
          if (!text) return "unsupportedWording";
          if (containsExcludedClaim(text, claims)) return "excluded";
          if (!isGroundedTextSafe(text, "linkedin")) return "unsafeWording";
          return undefined;
        }
      : undefined,
    target.category === "linkedin_connection"
      ? "linkedin_connection"
      : undefined,
    target.category === "linkedin_connection"
      ? (pool) => {
          const matchTargets = createLinkedinTargetMatcher(
            pool,
            target.connectionNoteLimit,
          );
          let best:
            | {
                entry: CandidateEvidenceRecord;
                fact: CandidateFact;
                content: string;
                match: ReturnType<typeof matchTargets>[number];
              }
            | undefined;
          let matchedCount = 0;
          for (const entry of explicit ?? allowedEvidence) {
            let matched = false;
            for (const fact of linkedinFacts?.get(entry.id) ?? []) {
              const content = normalizeAtomicSourceText(fact.excerpt);
              if (
                content.length > MAX_SUPPORTING_EXCERPT ||
                !isLinkedinExperience({ kind: fact.kind, content }) ||
                !isGroundedTextSafe(content, "linkedin")
              )
                continue;
              for (const match of matchTargets({
                id: fact.id,
                scope: "candidate",
                kind: fact.kind,
                content,
              })) {
                matched = true;
                if (
                  !best ||
                  (Number(isLinkedinJobTarget(match.source)) -
                    Number(isLinkedinJobTarget(best.match.source)) ||
                    Number(best.match.related) - Number(match.related) ||
                    match.domainScore - best.match.domainScore ||
                    match.score - best.match.score ||
                    best.entry.sortOrder - entry.sortOrder ||
                    best.entry.id.localeCompare(entry.id)) > 0
                )
                  best = { entry, fact, content, match };
              }
            }
            if (matched) matchedCount++;
          }
          if (!explicit && !injectionSafeMode) {
            selectionDiagnostics = {
              outcome: matchedCount
                ? "matched"
                : allowedEvidence.length
                  ? "no_match"
                  : "no_evidence",
              consideredCount: allowedEvidence.length,
              matchedCount,
            };
            if (best) {
              selectedEvidence = [best.entry];
              winningLinkedinFact = {
                entryId: best.entry.id,
                fact: best.fact,
                content: best.content,
              };
            }
          }
          if (!best) return pool;
          const targetId = best.match.source.id;
          return [
            best.match.source,
            ...pool.filter((source) => source.id !== targetId),
          ];
        }
      : undefined,
  );
  const targetContradicted =
    linkedin &&
    !targets.sources.length &&
    !injectionSafeMode &&
    linkedinTargetHasContradiction(
      target.profileMarkdown,
      target.jobDescription,
    );
  if (
    linkedin &&
    !explicit &&
    !injectionSafeMode &&
    !targets.sources.length &&
    !targets.diagnostics.excluded &&
    !targets.diagnostics.unsafeWording &&
    !targetContradicted
  ) {
    const entries = allowedEvidence
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    for (const entry of entries) {
      const fact = linkedinFacts?.get(entry.id)?.find((fact) => {
        const content = normalizeAtomicSourceText(fact.excerpt);
        return (
          content.length <= MAX_SUPPORTING_EXCERPT &&
          isLinkedinExperience({ kind: fact.kind, content }) &&
          isGroundedTextSafe(content, "linkedin") &&
          linkedinCandidateFits(
            { id: fact.id, kind: fact.kind, scope: "candidate", content },
            [],
            target.connectionNoteLimit,
          )
        );
      });
      if (!fact) continue;
      selectedEvidence = [entry];
      winningLinkedinFact = {
        entryId: entry.id,
        fact,
        content: normalizeAtomicSourceText(fact.excerpt),
      };
      break;
    }
  }
  let drafts: DraftSource[];

  if (injectionSafeMode) {
    drafts = safeSummaryDraft(input.candidate);
  } else {
    const evidence = selectedEvidence
      .map((entry) => ({
        id: `evidence:${entry.id}`,
        label:
          reviewedEvidence || winningLinkedinFact
            ? "Reviewed experience"
            : entry.title,
        content: linkedin
          ? (winningLinkedinFact?.content ??
            reviewedLinkedinEvidence(
              entry.id,
              targets.sources.length
                ? (linkedinFacts?.get(entry.id) ?? [])
                : [],
              targets.sources,
              target.connectionNoteLimit,
            ))
          : explicit
            ? budgetReviewedStory(
                entry,
                target.category === "cold_email" ? "email" : "linkedin",
                OUTREACH_GROUNDING_BUDGETS[target.category].maxSourceChars,
              )
            : reviewedStoryText(reviewedEvidence?.get(entry.id)),
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
    winningLinkedinFact
      ? new Map([[winningLinkedinFact.entryId, [winningLinkedinFact.fact]]])
      : (linkedinFacts ?? reviewedEvidence),
  ).filter(
    (source) =>
      target.category !== "linkedin_connection" ||
      linkedinCandidateFits(
        source,
        targets.sources,
        target.connectionNoteLimit,
      ),
  );
  const prepared = requiredEvidenceRoots
    ? prepareSelectedStoryFacts(
        budgetedSources,
        candidateAtoms,
        target.category === "cold_email" ? "email" : "linkedin",
      )
    : { sources: budgetedSources, safeAtoms: candidateAtoms };
  const { sources } = prepared;
  let proseRelevantFactIds: ReadonlySet<string> | undefined;
  if (target.category !== "linkedin_connection") {
    const matches = createReviewedFactMatcher(relevanceTarget);
    const survivingFactIds = new Set(prepared.safeAtoms.map(({ id }) => id));
    // Match original reviewed wording so markup escaping cannot add keywords.
    proseRelevantFactIds = new Set(
      selectedEvidence.flatMap((entry) => {
        const facts = reviewedEvidence
          ? (reviewedEvidence.get(entry.id) ?? [])
          : readFactReview(entry, entry.factReview);
        return facts.flatMap((fact) => {
          const id = candidateEvidenceFactId(`evidence:${entry.id}`, fact.id);
          return survivingFactIds.has(id) && matches(fact.excerpt) ? [id] : [];
        });
      }),
    );
  }
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
  // With neither source available, composition records the explicit-selection denial.
  const noLinkedinTarget =
    linkedin && !targets.sources.length && !winningLinkedinFact;
  if (
    requiredEvidenceRoots &&
    !noLinkedinTarget &&
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
    ...(proseRelevantFactIds ? { proseRelevantFactIds } : {}),
    targetDiagnostics: {
      ...targets.diagnostics,
      ...(targetContradicted ? { contradicted: true } : {}),
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
