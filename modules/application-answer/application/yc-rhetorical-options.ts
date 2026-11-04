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
import type { YcGroundingContext } from "../domain/yc-grounding.types";
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
    atomicSources: (context.atomicSources ?? []).filter(
      (s) =>
        s.scope === "target" ||
        (!!s.rootId && selection.sourceIds.includes(s.rootId)),
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

/** Find a complete answer under the existing free-form tool limits, without changing its tool. */
export function assertYcSelectionFeasible(context: YcGroundingContext) {
  const required = context.requiredEvidenceRoots;
  if (!required) return;

  const questions = context.questions ?? [{ questionId: "q1" }];
  for (const { questionId } of questions) {
    const scoped = ycQuestionContext(context, questionId, true);
    const sources = scoped.atomicSources ?? [];
    if (sources.length > 64) throw new YcPlanUnavailableError();
    if (
      sources.filter(({ scope }) => scope === "candidate").length >
      required.length * MAX_REVIEWED_FACTS
    )
      throw new YcPlanUnavailableError();
    const candidates = sources
      .flatMap((source) => {
        const index = required.indexOf(source.rootId ?? "");
        if (source.scope === "candidate" && index < 0) return [];
        return allowedClaimTexts(source).flatMap((text) => {
          try {
            inspectGroundedText(text, "general");
          } catch (error) {
            if (error instanceof GroundedTextSanitizationError) return [];
            throw error;
          }
          return [
            {
              rootBit: source.scope === "candidate" ? 1 << index : 0,
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
    let visits = 0;
    let validations = 0;
    const exhausted = () => visits >= 4096 || validations >= 256;
    const search = (start: number, words: number, roots: number): boolean => {
      if (
        words + remainingWords[start]! < APPLICATION_ANSWER_MIN_WORDS ||
        (roots | remainingRoots[start]!) !== requiredMask
      )
        return false;
      if (words >= APPLICATION_ANSWER_MIN_WORDS && roots === requiredMask) {
        validations++;
        const claims = group.map(({ claim }) => claim);
        if (
          isValidAnswer(
            scoped,
            claims.map(({ text }) => text).join(" "),
            claims,
          )
        )
          return true;
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
          nextWords > APPLICATION_ANSWER_MAX_WORDS ||
          group.some(
            ({ claim }) =>
              claim.source_id === candidate.claim.source_id ||
              claim.text === candidate.claim.text,
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
    if (!search(0, 0, 0)) throw new YcPlanUnavailableError();
  }
}

export function buildYcPlannedOptions(
  context: YcGroundingContext,
): YcPlannedOptions {
  const questions = context.questions ?? [
    { questionId: "q1", question: context.question },
  ];
  if (
    questions.length < 1 ||
    questions.length > 5 ||
    new Set(questions.map((q) => q.questionId)).size !== questions.length
  )
    throw new YcPlanUnavailableError();

  return questions.map((question, questionIndex) => {
    const scoped = ycQuestionContext(context, question.questionId, true);
    const selected = new Set(scoped.sources.map((s) => s.id));
    const sources = scoped.atomicSources ?? [];
    if (sources.length > 64) throw new YcPlanUnavailableError();
    const facts = sources.filter(
      (s) => s.scope === "candidate" && !!s.rootId && selected.has(s.rootId),
    );
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
    search: for (const size of [3, 2, 1]) {
      if (options.length) break;
      for (let i = 0; i < claims.length; i++)
        for (let j = i; j < claims.length; j++)
          for (let k = j; k < claims.length; k++) {
            const indices = [...new Set([i, j, k])];
            const group = indices.map((index) => claims[index]!);
            if (group.length !== size) continue;
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
            if (options.some((o) => o.body === body)) continue;
            const option = {
              id: `yc.${prefix}.${options.length + 1}`,
              body,
              claims: ordered,
              rhetoricalPlan,
            };
            const bytes = Buffer.byteLength(
              JSON.stringify({
                id: option.id,
                body,
                rhetorical_plan: planSelection(rhetoricalPlan),
              }),
              "utf8",
            );
            if (previewBytes + bytes > Math.floor(24000 / questions.length))
              continue;
            previewBytes += bytes;
            options.push(option);
            if (options.length === 8) break search;
          }
    }
    if (!options.length) throw new YcPlanUnavailableError();
    return { questionId: question.questionId, options };
  });
}
