import {
  APPLICATION_ANSWER_MIN_CLAIM_WORDS,
  renderYcAnswer,
  ycClaimSignature,
} from "../domain/render-yc-answer";
import { includesSelectedEvidence } from "@/modules/candidate-context/application/selected-evidence";
import {
  APPLICATION_ANSWER_MIN_WORDS,
  APPLICATION_ANSWER_MAX_WORDS,
  countOutputUnits,
} from "@/lib/ai/output-constraints";
import { createHash } from "node:crypto";
import {
  allowedClaimTexts,
  MAX_ATOMIC_CLAIMS,
  type AtomicClaim,
} from "@/modules/grounding/domain/atomic-claim";
import {
  buildRhetoricalPlan,
  orderedPlanClaims,
  planSelection,
  type RhetoricalPlan,
} from "@/modules/grounding/domain/rhetorical-plan";
import {
  applicationQuestionSources,
  type YcGroundingContext,
} from "../domain/yc-grounding.types";
import {
  validateYcApplicationOutput,
  YcApplicationOutputValidationError,
} from "./validate-yc-application-output";
import { AtomicClaimValidationError } from "@/modules/grounding/application/validate-atomic-claims";
import { GroundedOutputLimitError } from "@/modules/grounding/application/finalize-grounded-output";
import {
  GroundedTextSanitizationError,
  inspectGroundedText,
} from "@/lib/ai/sanitizer";
import { MAX_REVIEWED_FACTS } from "@/lib/candidate-profile/fact-review";
export class YcPlanUnavailableError extends Error {
  constructor() {
    super("No complete reviewed answer fits the question");
  }
}
export type YcPlannedOptions = Array<{
  questionId: string;
  options: Array<{
    id: string;
    body: string;
    claims: AtomicClaim[];
    rhetoricalPlan: RhetoricalPlan;
    claimSet?: number;
  }>;
}>;
/** Same question-local source boundary is used before the call and after sanitation. */
export function ycQuestionContext(
  context: YcGroundingContext,
  questionId: string,
  strict = false,
): YcGroundingContext {
  const selection = context.questions?.find((q) => q.questionId === questionId);
  if (!context.questions) return context;
  if (!selection) {
    if (strict) throw new YcPlanUnavailableError();
    return context;
  }
  return {
    ...context,
    question: selection.question,
    ...(selection.leadingFactIds && {
      leadingFactIds: selection.leadingFactIds,
    }),
    atomicSources: applicationQuestionSources(
      context.atomicSources ?? [],
      selection,
    ),
    sources: context.sources.filter((s) => selection.sourceIds.includes(s.id)),
  };
}
function isValidAnswer(
  context: YcGroundingContext,
  body: string,
  claims: AtomicClaim[],
) {
  try {
    validateYcApplicationOutput({
      context,
      output: {
        body,
        claims: claims.map((claim) => ({
          ...claim,
          sourceIds: [claim.source_id],
        })),
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof YcApplicationOutputValidationError ||
      error instanceof AtomicClaimValidationError ||
      error instanceof GroundedOutputLimitError ||
      error instanceof GroundedTextSanitizationError
    )
      return false;
    throw error;
  }
}

/** A bounded matching check ensures distinct questions have distinct options. */
function assertDistinctClaimSets(claimSets: readonly Set<string>[]) {
  const owners = new Map<string, number>();
  const assign = (question: number, visited: Set<string>): boolean => {
    for (const signature of claimSets[question]!) {
      if (visited.has(signature)) continue;
      visited.add(signature);
      const owner = owners.get(signature);
      if (owner === undefined || assign(owner, visited)) {
        owners.set(signature, question);
        return true;
      }
    }
    return false;
  };
  if (claimSets.some((_, index) => !assign(index, new Set())))
    throw new YcPlanUnavailableError();
}

/** Check that scoped facts can make complete answers before a provider call. */
export function assertYcSelectionFeasible(context: YcGroundingContext) {
  const required = context.requiredEvidenceRoots ?? [];
  const questions: NonNullable<YcGroundingContext["questions"]> =
    context.questions ?? [
      { questionId: "q1", question: context.question, sourceIds: [] },
    ];
  const claimSetsByQuestion = new Map<string | number, Set<string>>();
  const distinctQuestionCount = new Set(
    questions.map(({ question, questionGroup }) => questionGroup ?? question),
  ).size;
  for (const question of questions) {
    const { questionId } = question;
    const questionGroup = question.questionGroup ?? question.question;
    const scopedFacts = "reviewedFactIds" in question;
    if (!required.length && !scopedFacts) continue;
    if (scopedFacts && claimSetsByQuestion.has(questionGroup)) continue;
    const signatures = new Set<string>();
    const signatureLimit = scopedFacts ? distinctQuestionCount : 1;
    const scoped = ycQuestionContext(context, questionId, true);
    const sources = scoped.atomicSources ?? [];
    if (sources.length > 64) throw new YcPlanUnavailableError();
    const leading = new Set(scoped.leadingFactIds);
    if (scopedFacts && !leading.size) throw new YcPlanUnavailableError();
    if (
      required.length &&
      sources.filter(({ scope }) => scope === "candidate").length >
        required.length * MAX_REVIEWED_FACTS
    )
      throw new YcPlanUnavailableError();
    const candidates = sources
      .flatMap((source) => {
        const index = required.indexOf(source.rootId ?? "");
        if (required.length && source.scope === "candidate" && index < 0)
          return [];
        return allowedClaimTexts(source).flatMap((text) => {
          try {
            inspectGroundedText(text, "general");
          } catch (error) {
            if (error instanceof GroundedTextSanitizationError) return [];
            throw error;
          }
          return [
            {
              rootBit: index >= 0 ? 1 << index : 0,
              leads: leading.has(source.id),
              words: countOutputUnits(text, "words"),
              claim: {
                text,
                source_id: source.id,
                kind: source.kind,
                supporting_excerpt: source.content,
              },
            },
          ];
        });
      })
      .sort(
        (a, b) =>
          Number(b.leads) - Number(a.leads) ||
          Number(Boolean(b.rootBit)) - Number(Boolean(a.rootBit)) ||
          b.words - a.words,
      );

    // Bound traversal independently of how many target facts are available.
    const requiredMask = (1 << required.length) - 1;
    const group: typeof candidates = [];
    const remainingWords = new Array<number>(candidates.length + 1).fill(0);
    const remainingRoots = [...remainingWords];
    for (let i = candidates.length - 1; i >= 0; i--) {
      remainingWords[i] = remainingWords[i + 1]! + candidates[i]!.words;
      remainingRoots[i] = remainingRoots[i + 1]! | candidates[i]!.rootBit;
    }
    const collectAnswers = (minimumWords: number, maximumWords: number) => {
      let visits = 0;
      let validations = 0;
      const exhausted = () => visits >= 4096 || validations >= 256;
      const search = (start: number, words: number, roots: number): boolean => {
        if (
          words + remainingWords[start]! < minimumWords ||
          (roots | remainingRoots[start]!) !== requiredMask
        )
          return false;
        if (words >= minimumWords && roots === requiredMask) {
          validations++;
          const claims = group.map(({ claim }) => claim);
          if (isValidAnswer(scoped, renderYcAnswer(claims), claims)) {
            signatures.add(ycClaimSignature(claims));
            if (signatures.size >= signatureLimit) return true;
          }
        }
        if (group.length >= MAX_ATOMIC_CLAIMS) return false;
        for (
          let index = start;
          index < candidates.length && !exhausted();
          index++
        ) {
          visits++;
          const candidate = candidates[index]!;
          const nextWords = words + candidate.words;
          if (
            nextWords > maximumWords ||
            group.some(
              ({ claim }) =>
                claim.source_id === candidate.claim.source_id ||
                (scopedFacts
                  ? claim.supporting_excerpt ===
                    candidate.claim.supporting_excerpt
                  : claim.text === candidate.claim.text),
            )
          )
            continue;
          group.push(candidate);
          if (search(index + 1, nextWords, roots | candidate.rootBit))
            return true;
          group.pop();
        }
        return false;
      };
      return search(0, 0, 0);
    };
    // Sparse candidates must never spend the regular answer search budget.
    if (
      !collectAnswers(
        APPLICATION_ANSWER_MIN_WORDS,
        APPLICATION_ANSWER_MAX_WORDS,
      )
    )
      collectAnswers(
        APPLICATION_ANSWER_MIN_CLAIM_WORDS,
        APPLICATION_ANSWER_MIN_WORDS - 1,
      );
    if (!signatures.size) throw new YcPlanUnavailableError();
    if (scopedFacts) claimSetsByQuestion.set(questionGroup, signatures);
  }
  assertDistinctClaimSets([...claimSetsByQuestion.values()]);
}

export function buildYcPlannedOptions(
  context: YcGroundingContext,
): YcPlannedOptions {
  const questions: NonNullable<YcGroundingContext["questions"]> =
    context.questions ?? [
      { questionId: "q1", question: context.question, sourceIds: [] },
    ];
  if (
    questions.length < 1 ||
    questions.length > 5 ||
    new Set(questions.map((q) => q.questionId)).size !== questions.length
  )
    throw new YcPlanUnavailableError();

  const claimSetsByQuestion = new Map<string | number, Set<string>>();
  const claimSetIds = new Map<string, number>();
  const planned = questions.map((question, questionIndex) => {
    const questionGroup = question.questionGroup ?? question.question;
    const scopedFacts = "reviewedFactIds" in question;
    const scoped = ycQuestionContext(context, question.questionId, true);
    const selected = new Set(scoped.sources.map((s) => s.id));
    const sources = scoped.atomicSources ?? [];
    if (sources.length > 64) throw new YcPlanUnavailableError();
    const leading = new Set(scoped.leadingFactIds);
    const facts = sources
      .filter(
        (s) => s.scope === "candidate" && !!s.rootId && selected.has(s.rootId),
      )
      .sort((a, b) => Number(leading.has(b.id)) - Number(leading.has(a.id)));
    const claims = facts.map((s) => ({
      text: allowedClaimTexts(s).at(-1)!,
      source_id: s.id,
      kind: s.kind,
      supporting_excerpt: s.content,
    }));
    const wordCounts = claims.map((c) => c.text.trim().split(/\s+/u).length);
    const prefix = createHash("sha256")
      .update(JSON.stringify([scoped, question.questionId]))
      .digest("hex")
      .slice(0, 20);
    const options: YcPlannedOptions[number]["options"] = [];
    let previewBytes = 0;
    let attempts = 0;
    search: for (const size of scopedFacts ? [1, 2, 3] : [3, 2, 1]) {
      if (options.length && !scopedFacts) break;
      for (let i = 0; i < claims.length; i++)
        for (let j = i; j < claims.length; j++)
          for (let k = j; k < claims.length; k++) {
            const indices = [...new Set([i, j, k])];
            const group = indices.map((index) => claims[index]!);
            if (group.length !== size) continue;
            if (
              scopedFacts &&
              !group.some(({ source_id }) => leading.has(source_id))
            )
              continue;
            if (
              scoped.requiredEvidenceRoots &&
              !includesSelectedEvidence(
                scoped.requiredEvidenceRoots,
                indices.map((index) => facts[index]?.rootId),
              )
            )
              continue;
            const words = indices.reduce(
              (n, index) => n + wordCounts[index]!,
              0,
            );
            if (
              words < APPLICATION_ANSWER_MIN_WORDS ||
              words > APPLICATION_ANSWER_MAX_WORDS
            )
              continue;
            if (++attempts > 256) break search;
            const rhetoricalPlan = buildRhetoricalPlan({
              category: "yc_application",
              claims: group,
              sources,
              questionIndex,
            });
            const ordered = orderedPlanClaims(rhetoricalPlan, group);
            const body = ordered.map((c) => c.text).join(" ");
            if (!isValidAnswer(scoped, body, ordered)) continue;
            const signature = scopedFacts
              ? ycClaimSignature(ordered)
              : undefined;
            const claimSet =
              signature === undefined
                ? undefined
                : (claimSetIds.get(signature) ?? claimSetIds.size + 1);
            if (
              options.some((o) =>
                claimSet === undefined
                  ? o.body === body
                  : o.claimSet === claimSet,
              )
            )
              continue;
            const option = {
              id: `yc.${prefix}.${options.length + 1}`,
              body,
              claims: ordered,
              rhetoricalPlan,
              ...(claimSet !== undefined && { claimSet }),
            };
            const bytes = Buffer.byteLength(
              JSON.stringify({
                id: option.id,
                body,
                rhetorical_plan: planSelection(rhetoricalPlan),
                ...(claimSet !== undefined && { claim_set: claimSet }),
              }),
              "utf8",
            );
            if (previewBytes + bytes > Math.floor(24000 / questions.length))
              continue;
            if (signature !== undefined && claimSet !== undefined)
              claimSetIds.set(signature, claimSet);
            previewBytes += bytes;
            options.push(option);
            if (options.length === 8) break search;
          }
    }
    if (!options.length) throw new YcPlanUnavailableError();
    if (scopedFacts && !claimSetsByQuestion.has(questionGroup))
      claimSetsByQuestion.set(
        questionGroup,
        new Set(options.map(({ claims }) => ycClaimSignature(claims))),
      );
    return { questionId: question.questionId, options };
  });
  assertDistinctClaimSets([...claimSetsByQuestion.values()]);
  return planned;
}
