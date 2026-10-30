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

function tokens(value: string): Set<string> {
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\bartificial intelligence\b/gu, "ai")
    .replace(/\blarge language models?\b/gu, "llm")
    .replace(/\bmachine learning\b/gu, "ml")
    .replace(/\bretrieval[ -]augmented generation\b/gu, "rag");
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

/** Per-request matching data only; ownership, exclusions and fact support remain caller-owned. */
export function createEvidenceRanker(
  evidence: readonly CandidateEvidenceRecord[],
) {
  const eligible = evidence
    .filter((entry) => entry.confirmed)
    .map((entry) => ({
      entry,
      contribution: tokens(
        [entry.actions, entry.outcome, ...entry.metrics].join(" "),
      ),
      labels: tokens([entry.title, ...entry.skills].join(" ")),
      context: tokens(entry.context),
    }));
  return (target: {
    primary: string;
    secondary?: string;
  }): {
    evidence: CandidateEvidenceRecord[];
    diagnostics: EvidenceSelectionDiagnostics;
  } => {
    const primary = tokens(target.primary);
    const secondary = tokens(target.secondary ?? "");
    const ranked = eligible.map(({ entry, contribution, labels, context }) => {
      const first = match(primary, contribution, labels, context);
      const second = match(secondary, contribution, labels, context);
      return {
        entry,
        first,
        second,
        supported: primary.size ? first.supported : second.supported,
        aiTie: Number(
          (primary.size ? primary : secondary).has("ai") &&
            entry.kind === "ai_usage" &&
            (contribution.has("ai") || labels.has("ai")),
        ),
      };
    });
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
