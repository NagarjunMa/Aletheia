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

function match(
  target: ReadonlySet<string>,
  contribution: ReadonlySet<string>,
  labels: ReadonlySet<string>,
  context: ReadonlySet<string>,
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
  return { score, domainScore, supported };
}

/** The same topic policy ranks whole target units against a reviewed assertion. */
export function createEvidenceTargetRanker(
  targets: readonly string[],
): (_contribution: string) => number[] {
  const preparedTargets = targets.map(tokens);
  const byTerm = new Map<string, number[]>();
  preparedTargets.forEach((target, index) => {
    for (const term of target) {
      const indices = byTerm.get(term) ?? [];
      indices.push(index);
      byTerm.set(term, indices);
    }
  });
  const empty = new Set<string>();
  return (contribution) => {
    const prepared = tokens(contribution);
    const candidates = new Set(
      [...prepared].flatMap((term) => byTerm.get(term) ?? []),
    );
    return [...candidates]
      .map((index) => ({
        index,
        ...match(preparedTargets[index]!, prepared, empty, empty),
      }))
      .filter((item) => item.supported)
      .sort(
        (a, b) =>
          b.domainScore - a.domainScore ||
          b.score - a.score ||
          a.index - b.index,
      )
      .map((item) => item.index);
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
 * An excerpt array ranks only individual reviewed facts. The legacy string
 * projection retains record labels and context for LinkedIn connection ranking.
 */
export function createEvidenceRanker(
  evidence: readonly CandidateEvidenceRecord[],
  contributionText?: (
    _entry: CandidateEvidenceRecord,
  ) => string | readonly string[],
) {
  const eligible = evidence
    .filter((entry) => entry.confirmed)
    .map((entry) => {
      const text =
        contributionText?.(entry) ??
        [entry.actions, entry.outcome, ...entry.metrics].join(" ");
      if (typeof text !== "string") {
        return {
          entry,
          reviewed: text.map(prepareReviewedExcerpt),
          contribution: NO_TERMS,
          labels: NO_TERMS,
          context: NO_TERMS,
        };
      }
      return {
        entry,
        reviewed: undefined,
        contribution: tokens(text),
        labels: tokens([entry.title, ...entry.skills].join(" ")),
        context: tokens(entry.context),
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
    const ranked = eligible.map(
      ({ entry, contribution, labels, context, reviewed }) => {
        const first = reviewed
          ? bestReviewedMatch(primary, reviewed)
          : match(primary, contribution, labels, context);
        const second = reviewed
          ? bestReviewedMatch(secondary, reviewed)
          : match(secondary, contribution, labels, context);
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
