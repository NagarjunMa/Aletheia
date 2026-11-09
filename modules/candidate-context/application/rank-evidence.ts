import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";

import type { EvidenceSelectionDiagnostics } from "../domain/candidate-context.types";

const STOP_WORDS = new Set(
  "a an and are as at be by for from in is it of on or our that the their this to we who with you your why what how when where which describe tell give example examples about can could would should have has had did do does these those me us my will was were not experience background role roles position positions job jobs candidate strong good relevant makes make fit looking hiring seeking join want work working worked project projects company team teams engineer engineers engineering developer developers software build building built develop developed development systems system tool tools product products personal opportunity opportunities need needs needed please through using use used uses most impressive accomplishment accomplishments accomplished proud previous recent best greatest".split(
    " ",
  ),
);
const ALIASES = new Map(
  Object.entries({
    agents: "agent",
    agentic: "agent",
    policies: "policy",
    docs: "documentation",
    documenting: "documentation",
    documented: "documentation",
    evals: "evaluation",
    evaluations: "evaluation",
    evaluate: "evaluation",
    evaluated: "evaluation",
    evaluating: "evaluation",
    reliable: "reliability",
    mentored: "mentoring",
    mentor: "mentoring",
    tests: "testing",
    tested: "testing",
    test: "testing",
    services: "service",
    features: "feature",
    workflows: "workflow",
    llms: "llm",
    models: "model",
  }),
);
const AI_TERMS = new Set(["ai", "llm", "rag", "ml"]);
const AI_TOPIC_TERMS = new Set([...AI_TERMS, "agent"]);

// Match the non qualifier as a whole Unicode word.
const AI_AGENT_PATTERN =
  /(?<![\p{L}\p{N}_\p{Pd}])(?<!(?:^|[^\p{L}\p{M}\p{N}_])non[\s\p{White_Space}\p{Dash}]+)(?:ai|llms?|ml|rag)(?:[\s-]+(?:powered|based|grounded))?[\s-]+agents?\b/u;
const AI_OBSERVABILITY_PATTERN =
  /(?<![\p{L}\p{N}_\p{Dash}])(?<!(?:^|[^\p{L}\p{M}\p{N}_])(?:non|not|no|without|former|formerly)[\s\p{Dash}]+)ai[\s\p{Dash}]+observability\b/u;
const NAMED_AI_OBSERVABILITY =
  /^(?:applied )?ai[\s\p{Dash}]+observability(?: (?:platform|engineers|developers|designers|researchers))?[.!]?$/u;

function normalizeMatchingText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\bartificial intelligence\b/gu, "ai")
    .replace(/\blarge language models?\b/gu, "llm")
    .replace(/\bmachine learning\b/gu, "ml")
    .replace(/\bretrieval[ -]augmented generation\b/gu, "rag");
}

function tokens(value: string): Set<string> {
  const normalized = normalizeMatchingText(value);
  const result = new Set(
    (normalized.match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu) ?? [])
      .map((term) => term.replace(/\.+$/u, ""))
      .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
      .map((term) => ALIASES.get(term) ?? term),
  );
  if ([...result].some((term) => AI_TERMS.has(term))) result.add("ai");
  return result;
}

function hasAiObservabilityTopic(value: string): boolean {
  return normalizeMatchingText(value)
    .split(/\n\s*\n/u)
    .some((paragraph) => {
      const text = paragraph.trim().replace(/\s+/gu, " ");
      // Organization names in supported headlines and job facts aren't topics.
      const hiring = /^the (.+?) team at .+? is hiring (.+)$/u.exec(text);
      if (hiring)
        return (
          NAMED_AI_OBSERVABILITY.test(hiring[1]!) ||
          NAMED_AI_OBSERVABILITY.test(hiring[2]!)
        );
      const specialty = text.split(" | ")[1];
      return specialty
        ? specialty
            .split(" & ")
            .some((field) => NAMED_AI_OBSERVABILITY.test(field))
        : AI_OBSERVABILITY_PATTERN.test(text);
    });
}

function describesApplicationMonitoring(excerpt: string): boolean {
  // Match the whole assertion so an unrecognized qualifier cannot turn a
  // failed or unrelated monitoring effort into a positive relevance signal.
  const statement = normalizeMatchingText(excerpt)
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/^i(?: have|['’]ve) /u, "i ")
    .replace(/[.!]$/u, "")
    .replace(/,? (?:with no|without) downtime$/u, "")
    .replace(/ during (?:rollouts|releases|deployments|upgrades)$/u, "");
  const scope = / (?:on aws|in production)$/u;
  const technicalScope = scope.test(statement);
  const text = statement.replace(scope, "");
  const software = (object: string) =>
    /^(?:production (?:applications?|services?)|services?)$/u.test(object) ||
    (technicalScope && /^applications?$/u.test(object));
  const monitored = /^i monitor(?:ed)? (.+)$/u.exec(text)?.[1];
  if (monitored) return software(monitored);
  const action =
    /^i (?:built|designed|implemented|operated|maintained|set up|helped build|worked on building) (?:(?:a|an|the|aws|cloud|production) ){0,3}/u.exec(
      text,
    );
  if (!action) return false;
  const work = text.slice(action[0].length);
  if (
    /^(?:application|service) monitoring (?:infrastructure|tooling|platform|systems?)$/u.test(
      work,
    )
  )
    return true;
  const object =
    /^(?:monitoring infrastructure for|infrastructure (?:to monitor|for monitoring|that (?:can monitor|monitors?))) (?:the )?(.+)$/u.exec(
      work,
    )?.[1];
  return object !== undefined && software(object);
}

function match(
  target: ReadonlySet<string>,
  contribution: ReadonlySet<string>,
  labels: ReadonlySet<string>,
  context: ReadonlySet<string>,
  relatedObservability = false,
) {
  let score = 0;
  let domainScore = 0;
  let supported = false;
  const hasDomain = [...target].some((term) => !AI_TOPIC_TERMS.has(term));
  const agentHasAiSupport =
    !target.has("ai") || contribution.has("ai") || labels.has("ai");
  const specificAi = [...target].some(
    (term) => term !== "ai" && AI_TERMS.has(term),
  );
  for (const term of target) {
    // AI is a broader alias, not a second independent match for LLM/ML/RAG.
    if (term === "ai" && specificAi) continue;
    const weight = contribution.has(term)
      ? 3
      : labels.has(term)
        ? 2
        : context.has(term)
          ? 1
          : 0;
    const weighted = weight * (term === "ai" ? 1 : 2);
    score += weighted;
    if (!AI_TOPIC_TERMS.has(term)) domainScore += weighted;
    if (
      weight >= 2 &&
      (!hasDomain || !AI_TOPIC_TERMS.has(term)) &&
      (term !== "agent" || agentHasAiSupport) &&
      (term !== "ai" || target.size === 1)
    )
      supported = true;
  }
  // A related capability is eligible for ranking but below a direct domain match.
  if (relatedObservability && !contribution.has("observability"))
    return { score: 1, domainScore: 1, supported: true, related: true };
  return { score, domainScore, supported, related: false };
}

/** Rank complete LinkedIn target units against a reviewed assertion. */
export function createEvidenceTargetRanker(targets: readonly string[]) {
  const preparedTargets = targets.map(tokens);
  const observabilityTargets = new Set(
    targets.flatMap((target, index) =>
      hasAiObservabilityTopic(target) ? [index] : [],
    ),
  );
  const byTerm = new Map<string, number[]>();
  preparedTargets.forEach((target, index) => {
    for (const term of target) {
      const indices = byTerm.get(term) ?? [];
      indices.push(index);
      byTerm.set(term, indices);
    }
  });
  const empty = new Set<string>();
  return (contribution: string) => {
    const prepared = tokens(contribution);
    const candidates = new Set(
      [...prepared].flatMap((term) => byTerm.get(term) ?? []),
    );
    const relatedMonitoring = describesApplicationMonitoring(contribution);
    if (relatedMonitoring)
      for (const index of observabilityTargets) candidates.add(index);
    return [...candidates]
      .map((index) => ({
        index,
        ...match(
          preparedTargets[index]!,
          prepared,
          empty,
          empty,
          relatedMonitoring && observabilityTargets.has(index),
        ),
      }))
      .filter((item) => item.supported)
      .sort(
        (a, b) =>
          b.domainScore - a.domainScore ||
          b.score - a.score ||
          a.index - b.index,
      )
      .map(({ index, related }) => ({ index, related }));
  };
}

const NO_TERMS: ReadonlySet<string> = new Set();
function prepareReviewedExcerpt(excerpt: string) {
  return {
    terms: tokens(excerpt),
    aiAgent: AI_AGENT_PATTERN.test(normalizeMatchingText(excerpt)),
  };
}

function bestReviewedMatch(
  target: ReadonlySet<string>,
  excerpts: readonly { terms: ReadonlySet<string>; aiAgent: boolean }[],
) {
  const explicitAiAgents = target.has("ai") && target.has("agent");
  let best = { score: 0, domainScore: 0, supported: false };
  for (const excerpt of excerpts) {
    const candidate = match(target, excerpt.terms, NO_TERMS, NO_TERMS);
    // Activities cannot substitute for an explicit reviewed AI-agent assertion.
    if (explicitAiAgents && !excerpt.aiAgent) candidate.supported = false;
    if (
      Number(candidate.supported) > Number(best.supported) ||
      (candidate.supported === best.supported &&
        (candidate.domainScore > best.domainScore ||
          (candidate.domainScore === best.domainScore &&
            candidate.score > best.score)))
    )
      best = candidate;
  }
  return best;
}

export function createReviewedFactMatcher(target: {
  primary: string;
  secondary?: string;
}) {
  const primary = tokens(target.primary);
  const terms = primary.size ? primary : tokens(target.secondary ?? "");
  return (excerpt: string) =>
    bestReviewedMatch(terms, [prepareReviewedExcerpt(excerpt)]).supported;
}

/**
 * An excerpt array ranks only individual reviewed facts by default. LinkedIn
 * retains record labels and context while checking related work per excerpt.
 */
export function createEvidenceRanker(
  evidence: readonly CandidateEvidenceRecord[],
  contributionText?: (
    _entry: CandidateEvidenceRecord,
  ) => string | readonly string[],
  { linkedinConnection = false }: { linkedinConnection?: boolean } = {},
) {
  const eligible = evidence
    .filter((entry) => entry.confirmed)
    .map((entry) => {
      const text =
        contributionText?.(entry) ??
        [entry.actions, entry.outcome, ...entry.metrics].join(" ");
      if (typeof text !== "string" && !linkedinConnection) {
        return {
          entry,
          reviewed: text.map(prepareReviewedExcerpt),
          contribution: NO_TERMS,
          labels: NO_TERMS,
          context: NO_TERMS,
          relatedMonitoring: false,
        };
      }
      return {
        entry,
        reviewed: undefined,
        contribution: tokens(typeof text === "string" ? text : text.join("\n")),
        labels: tokens([entry.title, ...entry.skills].join(" ")),
        context: tokens(entry.context),
        relatedMonitoring:
          typeof text !== "string" && text.some(describesApplicationMonitoring),
      };
    });
  return (target: {
    primary: string;
    secondary?: string;
  }): {
    evidence: CandidateEvidenceRecord[];
    diagnostics: EvidenceSelectionDiagnostics;
  } => {
    const primary = tokens(target.primary);
    const secondary = tokens(target.secondary ?? "");
    const primaryObservability =
      linkedinConnection && hasAiObservabilityTopic(target.primary);
    const secondaryObservability =
      linkedinConnection && hasAiObservabilityTopic(target.secondary ?? "");
    const ranked = eligible.map(
      ({
        entry,
        contribution,
        labels,
        context,
        reviewed,
        relatedMonitoring,
      }) => {
        const first = reviewed
          ? bestReviewedMatch(primary, reviewed)
          : match(
              primary,
              contribution,
              labels,
              context,
              relatedMonitoring && primaryObservability,
            );
        const second = reviewed
          ? bestReviewedMatch(secondary, reviewed)
          : match(
              secondary,
              contribution,
              labels,
              context,
              relatedMonitoring && secondaryObservability,
            );
        return {
          entry,
          first,
          second,
          supported: primary.size ? first.supported : second.supported,
          aiTie: Number(
            (primary.size ? primary : secondary).has("ai") &&
              entry.kind === "ai_usage" &&
              (reviewed
                ? reviewed.some(({ terms }) => terms.has("ai"))
                : contribution.has("ai") || labels.has("ai")),
          ),
        };
      },
    );
    const matches = ranked
      .filter((item) => item.supported)
      .sort(
        (a, b) =>
          b.first.domainScore - a.first.domainScore ||
          b.first.score - a.first.score ||
          b.second.domainScore - a.second.domainScore ||
          b.second.score - a.second.score ||
          b.aiTie - a.aiTie ||
          a.entry.sortOrder - b.entry.sortOrder ||
          a.entry.id.localeCompare(b.entry.id),
      );
    return {
      evidence: matches.map((item) => item.entry),
      diagnostics: {
        outcome: !eligible.length
          ? "no_evidence"
          : matches.length
            ? "matched"
            : ranked.some((item) => item.first.score || item.second.score)
              ? "weak_match"
              : "no_match",
        consideredCount: eligible.length,
        matchedCount: matches.length,
      },
    };
  };
}
