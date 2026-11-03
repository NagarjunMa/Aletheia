import {
  APPLICATION_ANSWER_MIN_WORDS,
  APPLICATION_ANSWER_MAX_WORDS,
} from "@/lib/ai/output-constraints";
import { createHash } from "node:crypto";
import {
  allowedClaimTexts,
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
import { GroundedTextSanitizationError } from "@/lib/ai/sanitizer";
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
            try {
              validateYcApplicationOutput({
                context: scoped,
                output: {
                  body,
                  claims: ordered.map((c) => ({
                    ...c,
                    sourceIds: [c.source_id],
                  })),
                },
              });
            } catch (error) {
              if (
                error instanceof YcApplicationOutputValidationError ||
                error instanceof AtomicClaimValidationError ||
                error instanceof GroundedOutputLimitError ||
                error instanceof GroundedTextSanitizationError
              )
                continue;
              throw error;
            }
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
