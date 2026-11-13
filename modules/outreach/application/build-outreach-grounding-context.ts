import {
  countOutputUnits,
  resolveOutputConstraint,
} from "@/lib/ai/output-constraints";
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
  createEvidenceTargetRanker,
  createReviewedFactMatcher,
  createReviewedFactFocusRanker,
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
  isLinkedinCredentialTopic,
  isLinkedinTraitOnlyPost,
  linkedinHiringWording,
  linkedinJobHasRetraction,
  linkedinJobParagraphs,
  allowedClaimTexts,
  linkedinScopedAction,
  linkedinTargetHasContradiction,
  outreachJobSignals,
  MAX_SUPPORTING_EXCERPT,
  type AtomicSource,
} from "@/modules/grounding/domain/atomic-claim";
import {
  affirmativeExperience,
  linkedinCandidateFits,
  createLinkedinTargetMatcher,
  isLinkedinExperience,
  isLinkedinJobTarget,
  linkedinTargetFits,
  linkedinTargetWording,
  normalizeImplementationScope,
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
const HIRING_SIGNAL =
  /\b(?:hiring|recruiting|looking for|seeking|openings?|vacanc(?:y|ies))\b/iu;

type Relevance = ReturnType<
  ReturnType<typeof createEvidenceTargetRanker>
>[number];
function compareRelevance(a?: Relevance, b?: Relevance): number {
  if (!a || !b) return Number(Boolean(b)) - Number(Boolean(a));
  return (
    Number(a.related) - Number(b.related) ||
    b.domainScore - a.domainScore ||
    b.score - a.score
  );
}

function isLinkedinProfileRoleOnly(source: AtomicSource): boolean {
  return (
    source.rewrite === "linkedin_profile_interest" &&
    (linkedinTargetWording(source)?.startsWith("I'm interested in your ") ??
      false)
  );
}
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
  messageFocus?: string;
}): OutreachGroundingContext {
  const target = {
    ...input.target,
    profileMarkdown: normalizeText(input.target.profileMarkdown),
    jobDescription: normalizeText(input.target.jobDescription),
    conversationContext: normalizeText(input.target.conversationContext),
  };
  const linkedin = target.category === "linkedin_connection";
  const initialEmail =
    target.category === "cold_email" &&
    (target.emailMode ?? "initial_outreach") === "initial_outreach" &&
    !target.conversationContext;
  const job =
    linkedin || initialEmail
      ? outreachJobSignals(target.jobDescription)
      : undefined;
  const duties = job?.duties ?? [];
  const hasDuties = Boolean(job?.hasDuties);
  const roleHints = job?.roles ?? [];
  const roleSpecified = roleHints.length > 0 || Boolean(job?.hasNamedOpening);
  const sparseEmail =
    initialEmail && (!job?.hasOtherDetail || roleSpecified) && !hasDuties;
  const rankedEmail = initialEmail && (sparseEmail || hasDuties);
  // A repeated duty must not multiply comparisons with every reviewed fact.
  const distinctDuties = [
    ...new Map(
      duties.map((duty) => [`${duty.terms}\0${duty.topic ?? ""}`, duty]),
    ).values(),
  ];
  const dutyRank = createEvidenceTargetRanker(
    distinctDuties.map(({ terms }) => normalizeImplementationScope(terms)),
    undefined,
    { requireAiAgent: initialEmail, duty: true },
  );
  const dutyTopicRank = createEvidenceTargetRanker(
    distinctDuties.map(({ topic }) =>
      normalizeImplementationScope(topic ?? ""),
    ),
    distinctDuties.map(({ terms }) => normalizeImplementationScope(terms)),
    { requireAiAgent: initialEmail },
  );
  const roleRank = createEvidenceTargetRanker(
    roleHints.map(normalizeImplementationScope),
  );
  const profileRank = createEvidenceTargetRanker([
    normalizeImplementationScope(target.profileMarkdown),
  ]);
  const rankIntroduction = hasDuties
    ? dutyRank
    : roleSpecified
      ? roleRank
      : profileRank;
  const allowUnmatchedIntroduction = !hasDuties && !roleSpecified;
  const rankFact = (
    rank: ReturnType<typeof createEvidenceTargetRanker>,
    fact: CandidateFact,
    units = affirmativeExperience({ kind: fact.kind, content: fact.excerpt }),
  ) =>
    units
      .flatMap((text) =>
        rank(
          linkedinScopedAction(fact.excerpt) ?? fact.excerpt,
          normalizeImplementationScope(text),
        ),
      )
      .sort(compareRelevance)[0];
  const dutyMatches = new Map<CandidateFact, Relevance | undefined>();
  const matchDuty = (fact: CandidateFact) => {
    if (dutyMatches.has(fact)) return dutyMatches.get(fact);
    const direct = rankFact(dutyRank, fact);
    const topical = direct ? undefined : rankFact(dutyTopicRank, fact);
    const result =
      direct ?? (topical ? { ...topical, related: true } : undefined);
    dutyMatches.set(fact, result);
    return result;
  };
  const hiringSignal = linkedin && HIRING_SIGNAL.test(target.jobDescription);
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
    linkedin || initialEmail
      ? [
          target.profileMarkdown,
          target.jobDescription,
          target.conversationContext,
        ].join("\n\n")
      : target.profileMarkdown,
  );
  const injectionSafeMode = injectionScan.triggered;
  const emailContextBlocked =
    rankedEmail &&
    (linkedinJobHasRetraction(linkedinJobParagraphs(target.jobDescription)) ||
      containsExcludedClaim(target.jobDescription, claims));
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
  const relevanceTarget = {
    primary:
      target.jobDescription ||
      target.conversationContext ||
      target.profileMarkdown,
    secondary: `${target.profileMarkdown} ${target.conversationContext}`,
  };
  const focus = input.messageFocus?.trim();
  const rankFocus =
    focus && !injectionSafeMode && !scanForInjection(focus).triggered
      ? createReviewedFactFocusRanker(focus)
      : undefined;
  const proseLimit =
    rankFocus && !linkedin
      ? resolveOutputConstraint({
          category: target.category,
          emailMode: target.emailMode ?? "initial_outreach",
        })
      : undefined;
  const focusScores = new Map<CandidateFact, number>();
  const focusScore = (fact: CandidateFact): number => {
    if (!rankFocus) return 0;
    const cached = focusScores.get(fact);
    if (cached !== undefined) return cached;
    const content = normalizeClaimText(fact.excerpt);
    const score =
      proseLimit &&
      countOutputUnits(
        allowedClaimTexts({
          id: fact.id,
          scope: "candidate",
          kind: fact.kind,
          content,
        }).at(-1)!,
        proseLimit.unit,
      ) >= proseLimit.maximum
        ? 0
        : rankFocus(affirmativeExperience({ kind: fact.kind, content }));
    focusScores.set(fact, score);
    return score;
  };
  const focusFactScores = new Map<string, number>();
  const recordFocusMatch = (
    entry: CandidateEvidenceRecord,
    fact: CandidateFact,
  ) => {
    const score = focusScore(fact);
    if (score)
      focusFactScores.set(
        candidateEvidenceFactId(`evidence:${entry.id}`, fact.id),
        score,
      );
    return score;
  };
  const matchesProseTarget = linkedin
    ? undefined
    : createReviewedFactMatcher(relevanceTarget);
  const proseFocusPriority =
    rankFocus && !linkedin
      ? (fact: CandidateFact) => {
          const score = focusScore(fact);
          if (!score) return 0;
          if (rankedEmail && !explicit)
            return allowUnmatchedIntroduction ||
              rankFact(rankIntroduction, fact)
              ? score
              : 0;
          return matchesProseTarget?.(fact.excerpt) ? score : 0;
        }
      : undefined;
  const reviewedEvidence =
    !injectionSafeMode && !linkedin && (!explicit || proseFocusPriority)
      ? prepareReviewedStoryFacts(
          explicit ?? allowedEvidence,
          target.category === "cold_email" ? "email" : "linkedin",
          OUTREACH_GROUNDING_BUDGETS[target.category].maxSourceChars,
          proseFocusPriority,
        )
      : undefined;
  const emailMatches = new Map<string, ReadonlySet<string>>();
  const emailSelection =
    !rankedEmail || injectionSafeMode || explicit || emailContextBlocked
      ? undefined
      : allowedEvidence
          .flatMap((entry) => {
            const facts = reviewedEvidence?.get(entry.id) ?? [];
            const eligible = facts
              .flatMap((fact) => {
                const units = affirmativeExperience({
                  kind: fact.kind,
                  content: fact.excerpt,
                });
                if (!units.length) return [];
                const match = rankFact(rankIntroduction, fact, units);
                return match || allowUnmatchedIntroduction
                  ? [{ fact, match, focusScore: recordFocusMatch(entry, fact) }]
                  : [];
              })
              .sort(
                (a, b) =>
                  b.focusScore - a.focusScore ||
                  compareRelevance(a.match, b.match),
              );
            if (!eligible.length) return [];
            const best = eligible[0]?.match;
            emailMatches.set(
              entry.id,
              new Set(eligible.map(({ fact }) => fact.id)),
            );
            return [
              { entry, match: best, focusScore: eligible[0]?.focusScore ?? 0 },
            ];
          })
          .sort(
            (a, b) =>
              b.focusScore - a.focusScore ||
              compareRelevance(a.match, b.match) ||
              a.entry.sortOrder - b.entry.sortOrder ||
              a.entry.id.localeCompare(b.entry.id),
          );
  const selection =
    injectionSafeMode || explicit || linkedin || rankedEmail
      ? undefined
      : createEvidenceRanker(allowedEvidence, (entry) =>
          (reviewedEvidence?.get(entry.id) ?? []).map(({ excerpt }) => excerpt),
        )(relevanceTarget);
  const rankedProse =
    selection && rankFocus
      ? selection.evidence
          .map((entry) => ({
            entry,
            score: Math.max(
              0,
              ...(reviewedEvidence?.get(entry.id) ?? []).map((fact) =>
                matchesProseTarget?.(fact.excerpt)
                  ? recordFocusMatch(entry, fact)
                  : 0,
              ),
            ),
          }))
          .sort((a, b) => b.score - a.score)
          .map(({ entry }) => entry)
      : selection?.evidence;
  let selectedEvidence =
    explicit ??
    (emailSelection ? emailSelection.map(({ entry }) => entry) : rankedProse) ??
    [];
  let winningLinkedinFact:
    | {
        entryId: string;
        fact: CandidateFact;
        content: string;
        dutyMatch?: Relevance | undefined;
        focusScore: number;
      }
    | undefined;
  let selectionDiagnostics = emailSelection
    ? {
        outcome: (emailSelection.some(({ match }) => match)
          ? "matched"
          : allowedEvidence.length
            ? "no_match"
            : "no_evidence") as "matched" | "no_match" | "no_evidence",
        consideredCount: allowedEvidence.length,
        matchedCount: emailSelection.filter(({ match }) => match).length,
      }
    : selection?.diagnostics;
  const linkedinFacts =
    linkedin && !injectionSafeMode
      ? new Map(
          (explicit ?? allowedEvidence).map((entry) => [
            entry.id,
            completeLinkedinFacts(entry),
          ]),
        )
      : undefined;
  const emailDutyExcerpts =
    rankedEmail && hasDuties && !explicit
      ? new Map<number, Set<string>>()
      : undefined;
  for (const { text, paragraph } of duties) {
    if (!emailDutyExcerpts) break;
    const excerpts = emailDutyExcerpts.get(paragraph) ?? new Set<string>();
    excerpts.add(normalizeAtomicSourceText(text));
    emailDutyExcerpts.set(paragraph, excerpts);
  }
  const isEmailDutyTarget = (source: AtomicSource) =>
    source.id.startsWith("target.jobDescription.") &&
    Boolean(emailDutyExcerpts);
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
          const jobTargets = pool.filter(isLinkedinJobTarget);
          const preferPastedOpening = jobTargets.some((source) => {
            const kind = linkedinHiringWording(source.content)?.kind;
            return kind === "cofounder" || kind === "list";
          });
          const matchingTargets = preferPastedOpening
            ? jobTargets
            : hiringSignal && !jobTargets.length
              ? pool.filter((source) => !isLinkedinProfileRoleOnly(source))
              : pool;
          const matchTargets = createLinkedinTargetMatcher(
            matchingTargets,
            target.connectionNoteLimit,
          );
          let best:
            | {
                entry: CandidateEvidenceRecord;
                fact: CandidateFact;
                content: string;
                match: ReturnType<typeof matchTargets>[number];
                dutyMatch: Relevance | undefined;
                focusScore: number;
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
              const dutyMatch = explicit
                ? undefined
                : hasDuties
                  ? matchDuty(fact)
                  : roleSpecified
                    ? rankFact(roleRank, fact)
                    : undefined;
              if (hasDuties && !explicit && !dutyMatch) continue;
              const score = recordFocusMatch(entry, fact);
              for (const match of matchTargets({
                id: fact.id,
                scope: "candidate",
                kind: fact.kind,
                content,
              })) {
                matched = true;
                if (
                  !best ||
                  (score - best.focusScore ||
                    compareRelevance(best.dutyMatch, dutyMatch) ||
                    Number(isLinkedinJobTarget(match.source)) -
                      Number(isLinkedinJobTarget(best.match.source)) ||
                    Number(best.match.related) - Number(match.related) ||
                    match.domainScore - best.match.domainScore ||
                    match.score - best.match.score ||
                    best.entry.sortOrder - entry.sortOrder ||
                    best.entry.id.localeCompare(entry.id)) > 0
                )
                  best = {
                    entry,
                    fact,
                    content,
                    match,
                    dutyMatch,
                    focusScore: score,
                  };
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
                dutyMatch: best.dutyMatch,
                focusScore: best.focusScore,
              };
            }
          }
          if (!best) return matchingTargets;
          const targetId = best.match.source.id;
          return [
            best.match.source,
            ...matchingTargets.filter((source) => source.id !== targetId),
          ];
        }
      : emailDutyExcerpts
        ? (pool) =>
            [...pool].sort(
              (a, b) =>
                Number(isEmailDutyTarget(b)) - Number(isEmailDutyTarget(a)),
            )
        : undefined,
    emailDutyExcerpts,
  );
  let linkedinTargets = targets.sources;
  const hasJobTarget = linkedinTargets.some(isLinkedinJobTarget);
  const hasRoleTarget = linkedinTargets.some(
    (source) =>
      isLinkedinJobTarget(source) &&
      linkedinHiringWording(source.content)?.kind !== "list" &&
      /\bteam at .+ is hiring\b/iu.test(source.content),
  );
  const weakProfileOnly =
    linkedin &&
    linkedinTargets.length > 0 &&
    linkedinTargets.every(
      (source) =>
        (source.rewrite === "linkedin_profile_interest" ||
          source.rewrite === "linkedin_profile_topic") &&
        (isLinkedinCredentialTopic(source.content) ||
          isLinkedinProfileRoleOnly(source)),
    );
  const mayUseCandidateIntroduction =
    hasDuties ||
    (roleSpecified && winningLinkedinFact && !winningLinkedinFact.dutyMatch) ||
    (!winningLinkedinFact &&
      ((roleSpecified && (!hasJobTarget || hasRoleTarget)) ||
        !linkedinTargets.length ||
        weakProfileOnly ||
        (linkedin && isLinkedinTraitOnlyPost(target.jobDescription))));
  const targetContradicted =
    linkedin &&
    mayUseCandidateIntroduction &&
    !injectionSafeMode &&
    linkedinTargetHasContradiction(
      target.profileMarkdown,
      target.jobDescription,
    );
  if (
    linkedin &&
    !explicit &&
    !injectionSafeMode &&
    mayUseCandidateIntroduction &&
    !targets.diagnostics.excluded &&
    !targets.diagnostics.unsafeWording &&
    !targetContradicted
  ) {
    const introductions = allowedEvidence
      .flatMap((entry) =>
        (linkedinFacts?.get(entry.id) ?? []).flatMap((fact) => {
          const content = normalizeAtomicSourceText(fact.excerpt);
          if (!(
            content.length <= MAX_SUPPORTING_EXCERPT &&
            isLinkedinExperience({ kind: fact.kind, content }) &&
            isGroundedTextSafe(content, "linkedin") &&
            linkedinCandidateFits(
              { id: fact.id, kind: fact.kind, scope: "candidate", content },
              [],
              target.connectionNoteLimit,
            )
          ))
            return [];
          const match = hasDuties
            ? matchDuty(fact)
            : rankFact(rankIntroduction, fact);
          if (!match && !allowUnmatchedIntroduction) return [];
          return [
            {
              entry,
              fact,
              content,
              match,
              focusScore: recordFocusMatch(entry, fact),
            },
          ];
        }),
      )
      .sort(
        (a, b) =>
          b.focusScore - a.focusScore ||
          compareRelevance(a.match, b.match) ||
          a.entry.sortOrder - b.entry.sortOrder ||
          a.entry.id.localeCompare(b.entry.id),
      );
    const winner = introductions[0];
    if (
      winner &&
      (!winningLinkedinFact ||
        winner.focusScore > winningLinkedinFact.focusScore ||
        (winner.focusScore === winningLinkedinFact.focusScore &&
          (hasDuties || roleSpecified) &&
          compareRelevance(winner.match, winningLinkedinFact.dutyMatch) < 0))
    ) {
      const { entry, fact, content } = winner;
      selectedEvidence = [entry];
      winningLinkedinFact = {
        entryId: entry.id,
        fact,
        content,
        focusScore: winner.focusScore,
      };
      linkedinTargets = [];
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
              linkedinTargets.length
                ? (linkedinFacts?.get(entry.id) ?? [])
                : [],
              linkedinTargets,
              target.connectionNoteLimit,
            ))
          : explicit && !proseFocusPriority
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
    linkedin ? "linkedin_connection" : undefined,
  ).filter(
    (source) =>
      target.category !== "linkedin_connection" ||
      linkedinCandidateFits(
        source,
        linkedinTargets,
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
    const survivingFactIds = new Set(prepared.safeAtoms.map(({ id }) => id));
    // Match original reviewed wording so markup escaping cannot add keywords.
    proseRelevantFactIds = new Set(
      selectedEvidence.flatMap((entry) => {
        if (rankedEmail && !explicit) {
          const root = `evidence:${entry.id}`;
          return [...(emailMatches.get(entry.id) ?? [])]
            .map((id) => candidateEvidenceFactId(root, id))
            .filter((id) => survivingFactIds.has(id));
        }
        const facts = reviewedEvidence
          ? (reviewedEvidence.get(entry.id) ?? [])
          : readFactReview(entry, entry.factReview);
        return facts.flatMap((fact) => {
          const id = candidateEvidenceFactId(`evidence:${entry.id}`, fact.id);
          return survivingFactIds.has(id) && matchesProseTarget?.(fact.excerpt)
            ? [id]
            : [];
        });
      }),
    );
  }
  if (explicit && rankFocus) {
    for (const entry of explicit)
      for (const fact of readFactReview(entry, entry.factReview))
        recordFocusMatch(entry, fact);
  }
  if (rankFocus && proseRelevantFactIds?.size) {
    proseRelevantFactIds = new Set(
      [...proseRelevantFactIds].sort(
        (a, b) => (focusFactScores.get(b) ?? 0) - (focusFactScores.get(a) ?? 0),
      ),
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

  const atomicSources = [...prepared.safeAtoms, ...linkedinTargets];
  const emailDutyFactIds = emailDutyExcerpts
    ? new Map(
        linkedinTargets.filter(isEmailDutyTarget).map((source) => {
          const exact = duties.find(
            ({ text }) => normalizeAtomicSourceText(text) === source.content,
          );
          const rank = createEvidenceTargetRanker(
            exact ? [exact.terms] : [],
            undefined,
            { requireAiAgent: true, duty: true },
          );
          const matching = selectedEvidence.flatMap((entry) =>
            (reviewedEvidence?.get(entry.id) ?? []).flatMap((fact) => {
              const id = candidateEvidenceFactId(
                `evidence:${entry.id}`,
                fact.id,
              );
              return proseRelevantFactIds?.has(id) && rankFact(rank, fact)
                ? [id]
                : [];
            }),
          );
          return [source.id, new Set(matching)] as const;
        }),
      )
    : undefined;
  // With neither source available, composition records the explicit-selection denial.
  const noLinkedinTarget =
    linkedin && !linkedinTargets.length && !winningLinkedinFact;
  if (
    requiredEvidenceRoots &&
    !noLinkedinTarget &&
    !includesSelectedEvidence(
      requiredEvidenceRoots,
      atomicSources.map((source) => source.rootId),
    )
  )
    throw new SelectedEvidenceUnavailableError();

  const matchFinalLinkedinTargets =
    rankFocus && linkedin && linkedinTargets.length
      ? createLinkedinTargetMatcher(linkedinTargets, target.connectionNoteLimit)
      : undefined;
  const matchedFocus =
    rankFocus &&
    prepared.safeAtoms.some(
      (source) =>
        focusFactScores.has(source.id) &&
        (linkedin
          ? (!matchFinalLinkedinTargets ||
              matchFinalLinkedinTargets(source).length > 0) &&
            isLinkedinExperience(source)
          : proseRelevantFactIds?.has(source.id)),
    );
  const focusSelection: OutreachGroundingContext["focusSelection"] = focus
    ? {
        outcome: matchedFocus
          ? "matched"
          : explicit
            ? "selection_conflict"
            : "no_match",
      }
    : undefined;

  return {
    identity: input.candidate.identity,
    ...(focusSelection ? { focusSelection } : {}),
    ...(selectionDiagnostics ? { selectionDiagnostics } : {}),
    ...(requiredEvidenceRoots ? { requiredEvidenceRoots } : {}),
    sources,
    atomicSources,
    ...(rankedEmail && !explicit && !emailContextBlocked
      ? { domainAwareEmail: true }
      : {}),
    ...(emailDutyFactIds?.size ? { emailDutyFactIds } : {}),
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
