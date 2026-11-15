import {
  assertSafeSelectionText,
  includesSelectedEvidence,
  prepareReviewedStoryFacts,
  prepareSelectedStoryFacts,
  resolveSelectedEvidence,
  reviewedStoryText,
  SelectedEvidenceUnavailableError,
} from "@/modules/candidate-context/application/selected-evidence";
import { normalizeClaimText } from "@/modules/grounding/domain/atomic-claim";
import {
  createEvidenceRanker,
  createReviewedFactRanker,
} from "@/modules/candidate-context/application/rank-evidence";
import {
  normalizeForExclusion,
  containsExcludedClaim,
} from "@/modules/grounding/domain/excluded-claims";
import { escapeForXmlTag } from "@/lib/ai/prompts/linkedin-connection";
import {
  buildAtomicCandidateSources,
  buildAtomicTargetSources,
  candidateEvidenceFactId,
} from "@/modules/grounding/application/build-atomic-sources";
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

type DraftSource = YcGroundingSource & {
  rawContent: string;
};

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

const choiceVerb =
  "choose|chose|choosing|use|used|using|select(?:ed|ing)?|adopt(?:ed|ing)?|pick(?:ed|ing)?|opt(?:ed|ing)? for|go(?:ing)? with|went with|decid(?:e|ed|ing) on";
const decision = String.raw`(?:(?:(?:decid(?:e|ed|ing)|choos(?:e|ing)|chose)\s+to|end(?:ed|ing)?\s+up)\s+)?(?:(?<deploy>deploy(?:ed|ing)?\s+(?:using|with))|(?<continued>continu(?:e|ed|ing)\s+(?:using|with))|(?:${choiceVerb}))`;
const causalVerb = String.raw`motivated|prompted|informed|guided|shaped|drove|led\s+to`;
const decisionActor = String.raw`(?:i|we|my team|our team|the team)`;
const reasonOwner = String.raw`(?:my|our|the team['’]s)\s+(?:reasons?|rationale)`;
const statedReasonText = String.raw`(?<reason>[\p{L}\p{N}].*)$`;
const reasonDetail = String.raw`(?:was|were|is|are)\s+${statedReasonText}`;
const rationaleQuestion = new RegExp(
  String.raw`^(?:why\s+(?:(?:do|did|had)\s+)?(?:you|your team|the team|we)|what\s+(?:(?:motivated|prompted|led)\s+(?:you|your team|the team|us)\s+to|made\s+(?:you|your team|the team|us)|(?:(?:factors|considerations)\s+)?(?:${causalVerb})\s+(?:your|the(?: team['’]s)?)\s+decision\s+to)|(?:what\s+(?:was|were|is|are)\s+)?(?:(?:your|the|our)\s+)?(?:reasons?|rationale)\s+(?:for|behind))\s+${decision}\s+(?<subject>[^?!]+)[?!]*$`,
  "iu",
);
const choiceRationaleQuestion = new RegExp(
  String.raw`^what\s+(?:${causalVerb})\s+(?:your|the(?: team['’]s)?)\s+(?:choice|selection)\s+of\s+(?<subject>[^?!]+)[?!]*$`,
  "iu",
);
const passiveRationaleQuestion =
  /^why\s+(?:was|were|is|are)\s+(.+?)\s+(?:chosen|used|selected|adopted|picked)\b([^?!]*)[?!]*$/iu;
const choiceWithReason = new RegExp(
  String.raw`^${decisionActor}\s+${decision}\s+(?<subject>.+?)\s+(?:because|so that|in order to)\s+${statedReasonText}`,
  "iu",
);
const reasonForChoice = new RegExp(
  String.raw`^${reasonOwner}\s+for\s+${decision}\s+(?<subject>.+?)\s+${reasonDetail}`,
  "iu",
);
const statedChoice = new RegExp(
  String.raw`^${decisionActor}\s+${decision}\s+(?<subject>[^!?]+)$`,
  "iu",
);
const statedReason = new RegExp(
  String.raw`^${reasonOwner}\s+${reasonDetail}`,
  "iu",
);

function normalizeDecisionSubject(value: string): string {
  return normalizeForMatching(
    value.trim().replace(/^(?:a|an|the)\s+/iu, ""),
  ).replace(/\.+$/u, "");
}

function rationaleScope(text: string): { scope: string; statement: string } {
  const prefix = /^(?:for|during|in)\s+([^,\n]+),\s*/iu.exec(text);
  return prefix
    ? {
        scope: normalizeDecisionSubject(
          prefix[1]!.replace(/^(?:my|our|your)\s+/iu, ""),
        ),
        statement: text.slice(prefix[0].length),
      }
    : { scope: "", statement: text };
}

function decisionSubject(match: RegExpExecArray, scope: string): string {
  let subject = normalizeDecisionSubject(match.groups?.subject ?? "");
  if (!subject) return "";
  if (match.groups?.deploy && !/\bfor\b/u.test(subject))
    subject += " for deployment";
  return [scope, match.groups?.continued && "continued use", subject]
    .filter(Boolean)
    .join("\n");
}

export function applicationRationaleRequest(
  question: string,
): { subject: string } | undefined {
  const text = normalizeText(question);
  const { scope, statement } = rationaleScope(text);
  const inquiry = statement.replace(
    /^(?:please\s+)?(?:explain|describe)\s+/iu,
    "",
  );
  const active =
    rationaleQuestion.exec(inquiry) ?? choiceRationaleQuestion.exec(inquiry);
  if (active) return { subject: decisionSubject(active, scope) };
  const passive = passiveRationaleQuestion.exec(inquiry);
  if (passive)
    return {
      subject: [scope, normalizeDecisionSubject(`${passive[1]} ${passive[2]}`)]
        .filter(Boolean)
        .join("\n"),
    };

  // An explicit request for a reason still needs one when the choice cannot
  // be scoped reliably. Do not fall through to action-only evidence.
  if (
    /\b(?:why|reasons?|rationale|what (?:factors|considerations|led|motivated|prompted|informed|drove))\b/iu.test(
      text,
    ) &&
    /\b(?:choos(?:e|ing)|chose|chosen|choice|decid(?:e|ed|ing)|decision|select(?:ed|ing|ion)?|adopt(?:ed|ing|ion)?|opt(?:ed|ing)? for|picked|continu(?:e|ed|ing) (?:using|with)|end(?:ed|ing)? up (?:using|with)|instead of|rather than|trade[- ]?off)\b/iu.test(
      text,
    )
  )
    return { subject: "" };
  return undefined;
}

function hasStatedReason(value: string | undefined): boolean {
  const reason = normalizeForMatching(value ?? "").replace(/\.+$/u, "");
  // Strip language that describes the status of the reason before checking for a reference.
  const content = reason
    .replace(
      /^(?:that\s+)?(?:(?:it|(?:(?:my|our|the|their|this)\s+)?(?:reasons?|rationale))\s+)?/u,
      "",
    )
    .replace(
      /^(?:(?:to|be|been|being|is|are|was|were|has|have|had|will|would|can|could|should|already|only|just|still|\p{L}+ly)\s+)*/u,
      "",
    );
  return (
    Boolean(content) &&
    !/^(?:not|never)\b/u.test(content) &&
    !/^(?:recorded|documented|noted|listed|stored|written(?: down)?|explained|described|mentioned|provided|shared|reported|published|disclosed|set out)(?:$|\s+(?:in|on|at|by|with|elsewhere|above|below|later|earlier|separately|\p{L}+ly)\b)/u.test(
      content,
    ) &&
    !/^(?:(?:an?|the)\s+)?(?:internal|private|confidential)(?:$|\s+(?:matter|details?|reasons?|discussion)\b)/u.test(
      content,
    ) &&
    !/^(?:kept private|kept confidential|withheld|undisclosed|unavailable|redacted)\b/u.test(
      content,
    )
  );
}

function statesRationale(excerpt: string, subject: string): boolean {
  return normalizeText(excerpt)
    .split(/\n+|(?<=[.!?])\s+/u)
    .some((sentence, index, sentences) => {
      const { scope, statement } = rationaleScope(sentence.trim());
      const inline =
        choiceWithReason.exec(statement) ?? reasonForChoice.exec(statement);
      const following = statedReason.exec(sentences[index + 1]?.trim() ?? "");
      const choice = hasStatedReason(inline?.groups?.reason)
        ? inline
        : hasStatedReason(following?.groups?.reason)
          ? statedChoice.exec(statement)
          : null;
      return Boolean(
        choice?.groups?.subject &&
        !/[;,]|\band (?:I|we|they|the team)\b/iu.test(choice.groups.subject) &&
        decisionSubject(choice, scope) === subject,
      );
    });
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
  distinctStories: boolean,
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
    const key =
      distinctStories && draft.type === "evidence" ? draft.id : signature;
    if (!signature || seen.has(key)) continue;

    seen.add(key);
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
  usableSources: YcGroundingSource[],
  candidate: CandidateGroundingData,
  selectedEvidence: CandidateEvidenceRecord[],
): YcGroundingReadiness {
  const sourceIds = new Set(sources.map((source) => source.id));
  const hasBackground =
    sourceIds.has("profile.current_role") || sourceIds.has("resume.primary");
  // Background remains a profile-completeness requirement, not permission to
  // cite raw profile/resume text. Candidate claims need a separately reviewed fact.
  const hasEvidence = usableSources.some(
    (source) => source.type === "evidence",
  );
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
  questions?: string[];
  jobDescription: string;
  candidate: CandidateGroundingData;
  selectedEvidenceIds?: readonly string[];
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
  const explicit = input.selectedEvidenceIds?.length
    ? resolveSelectedEvidence(
        input.selectedEvidenceIds,
        allowedEvidence,
        YC_GROUNDING_MAX_EVIDENCE,
        excludedClaims,
      )
    : undefined;
  const requiredEvidenceRoots = explicit?.map(
    (entry) => `evidence:${entry.id}`,
  );
  const questions = input.questions ?? [normalizedQuestion];
  if (explicit)
    assertSafeSelectionText(
      [...questions, normalizedJobDescription].join("\n"),
    );
  const reviewedEvidence = prepareReviewedStoryFacts(
    explicit ?? allowedEvidence,
    "general",
    MAX_EVIDENCE_SOURCE_CHARS,
  );
  const rankEvidence = explicit
    ? undefined
    : createEvidenceRanker(
        allowedEvidence,
        (entry) =>
          reviewedEvidence.get(entry.id)?.map(({ excerpt }) => excerpt) ?? [],
      );
  const targets = questions.map((question) => ({
    primary: normalizeText(question),
    secondary: normalizedJobDescription,
  }));
  const questionTexts = targets.map(({ primary }) => primary);
  const rationaleFacts = questionTexts.map((question) => {
    const request = input.questions && applicationRationaleRequest(question);
    if (!request) return undefined;
    const matching = new Map<string, Set<string>>();
    if (!request.subject) return matching;
    for (const [id, facts] of reviewedEvidence) {
      const reasons = facts.filter(({ excerpt }) =>
        statesRationale(excerpt, request.subject),
      );
      if (reasons.length)
        matching.set(id, new Set(reasons.map(({ id }) => id)));
    }
    return matching;
  });
  const selections = rankEvidence ? targets.map(rankEvidence) : [];
  const rankedByQuestion = explicit
    ? questions.map(() => explicit)
    : selections.map((selection, index) =>
        selection.evidence
          .filter(
            ({ id }) => !rationaleFacts[index] || rationaleFacts[index].has(id),
          )
          .slice(0, YC_GROUNDING_MAX_EVIDENCE),
      );
  // Round-robin selection reserves an opportunity for each question's best source
  // without multiplying the existing six-source / 16k-character prompt budget.
  const selectedEvidence: CandidateEvidenceRecord[] = [];
  for (let rank = 0; rank < YC_GROUNDING_MAX_EVIDENCE; rank++) {
    for (const ranked of rankedByQuestion) {
      const entry = ranked[rank];
      if (
        entry &&
        !selectedEvidence.some((selected) => selected.id === entry.id) &&
        selectedEvidence.length < YC_GROUNDING_MAX_EVIDENCE
      )
        selectedEvidence.push(entry);
    }
  }

  const evidenceDrafts: DraftSource[] = selectedEvidence.map((entry) => ({
    id: `evidence:${entry.id}`,
    type: "evidence",
    label: "Reviewed experience",
    content: reviewedStoryText(reviewedEvidence.get(entry.id)),
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

  const budgetedSources = applySafetyAndBudget(
    [
      ...evidenceDrafts,
      ...profileDraftSources(input.candidate),
      ...resumeDrafts,
    ],
    excludedClaims,
    Boolean(explicit),
  );
  const candidateAtoms = buildAtomicCandidateSources(
    input.candidate,
    budgetedSources,
    explicit ? undefined : reviewedEvidence,
  );
  const prepared = requiredEvidenceRoots
    ? prepareSelectedStoryFacts(budgetedSources, candidateAtoms, "general")
    : { sources: budgetedSources, safeAtoms: candidateAtoms };
  const availableByRoot = new Map<string, string[]>();
  for (const atom of prepared.safeAtoms) {
    if (!atom.rootId) continue;
    const excerpts = availableByRoot.get(atom.rootId) ?? [];
    excerpts.push(atom.content);
    availableByRoot.set(atom.rootId, excerpts);
  }
  // Only original reviewed text from facts still in the ledger can qualify.
  const survivingFactIds = new Set(prepared.safeAtoms.map(({ id }) => id));
  const rankAvailable = explicit
    ? undefined
    : createEvidenceRanker(selectedEvidence, (entry) =>
        (reviewedEvidence.get(entry.id) ?? [])
          .filter(({ id }) =>
            survivingFactIds.has(
              candidateEvidenceFactId(`evidence:${entry.id}`, id),
            ),
          )
          .map(({ excerpt }) => excerpt),
      );
  const availableByQuestion = rankAvailable
    ? targets.map((target, index) => {
        const originallyRanked = new Set(
          rankedByQuestion[index]?.map(({ id }) => id),
        );
        return rankAvailable(target).evidence.filter(({ id }) =>
          originallyRanked.has(id),
        );
      })
    : rankedByQuestion;
  const reviewedFactsByQuestion =
    questions.length > 1 ||
    (input.questions && (!explicit || rationaleFacts.some(Boolean)))
      ? targets.map((target, index) => {
          const rank = createReviewedFactRanker(target);
          const rationale = rationaleFacts[index];
          const rankedFacts = (availableByQuestion[index] ?? [])
            .flatMap((entry) => {
              const reasons = rationale?.get(entry.id);
              if (rationale && !reasons) return [];
              const currentFacts = (
                reviewedEvidence.get(entry.id) ?? []
              ).flatMap(({ id, excerpt }) => {
                const factId = candidateEvidenceFactId(
                  `evidence:${entry.id}`,
                  id,
                );
                if (!survivingFactIds.has(factId)) return [];
                const score = rank(excerpt);
                const reason = reasons?.has(id) ?? false;
                return score || reason ? [{ factId, score, reason }] : [];
              });
              return !rationale || currentFacts.some(({ reason }) => reason)
                ? currentFacts
                : [];
            })
            .sort(
              (a, b) =>
                Number(b.reason) - Number(a.reason) || b.score - a.score,
            );
          const highest = Math.max(0, ...rankedFacts.map(({ score }) => score));
          return {
            reviewedFactIds: rankedFacts.map(({ factId }) => factId),
            ...(questions.length > 1 && {
              questionGroup: questionTexts.indexOf(target.primary) + 1,
            }),
            leadingFactIds: rankedFacts
              .filter(({ score, reason }) =>
                rationale
                  ? reason
                  : questions.length === 1 || score === highest,
              )
              .map(({ factId }) => factId),
          };
        })
      : undefined;
  const usableRoots = new Set(
    availableByQuestion.flatMap((ranked) =>
      ranked
        .map(({ id }) => `evidence:${id}`)
        .filter((root) => availableByRoot.has(root)),
    ),
  );
  if (
    requiredEvidenceRoots &&
    !includesSelectedEvidence(requiredEvidenceRoots, usableRoots)
  )
    throw new SelectedEvidenceUnavailableError();
  const sources = explicit
    ? prepared.sources
    : prepared.sources.flatMap((source) =>
        source.type !== "evidence"
          ? [source]
          : usableRoots.has(source.id)
            ? [
                {
                  ...source,
                  content: escapeForXmlTag(
                    availableByRoot.get(source.id)!.join("\n"),
                  ),
                },
              ]
            : [],
      );
  const atomicSources = [
    ...prepared.safeAtoms.filter(
      (source) => source.rootId && usableRoots.has(source.rootId),
    ),
    ...buildAtomicTargetSources(
      { jobDescription: normalizedJobDescription },
      excludedClaims,
    ).sources,
  ];
  const usableSources = sources.filter((source) => usableRoots.has(source.id));
  const readiness = buildReadiness(
    sources,
    usableSources,
    input.candidate,
    selectedEvidence,
  );
  // Every batch question needs eligible evidence before quota, credits or model work.
  if (
    input.questions &&
    (availableByQuestion.some((ranked) => !ranked.length) ||
      rationaleFacts.some(
        (required, index) =>
          required && !reviewedFactsByQuestion?.[index]?.reviewedFactIds.length,
      ))
  ) {
    readiness.ready = false;
    if (!readiness.missingFields.includes("confirmed_evidence"))
      readiness.missingFields.push("confirmed_evidence");
  }
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
    ...(requiredEvidenceRoots
      ? { requiredEvidenceRoots }
      : {
          selectionDiagnostics: selections.map(({ diagnostics }, index) => {
            const matchedCount = availableByQuestion[index]?.length ?? 0;
            return {
              ...diagnostics,
              matchedCount,
              outcome:
                !matchedCount && diagnostics.outcome === "matched"
                  ? ("weak_match" as const)
                  : diagnostics.outcome,
            };
          }),
        }),
    question: escapeForXmlTag(normalizedQuestion),
    ...(input.questions
      ? {
          questions: input.questions.map((question, index) => ({
            questionId: `q${index + 1}`,
            question: escapeForXmlTag(normalizeText(question)),
            ...reviewedFactsByQuestion?.[index],
            sourceIds: sources
              .filter(
                (source) =>
                  source.type !== "evidence" ||
                  availableByQuestion[index]?.some(
                    (entry) => source.id === `evidence:${entry.id}`,
                  ),
              )
              .map((source) => source.id),
          })),
        }
      : {}),
    jobDescription: escapeForXmlTag(normalizedJobDescription),
    sources,
    excludedClaims: excludedClaims.map(escapeForXmlTag),
    atomicSources,
    readiness,
    metadata: {
      profileFieldCount,
      confirmedEvidenceCount,
      resumeSource,
    },
  };
}
