import { it, expect, vi } from "vitest";
import { buildYcPlannedOptions } from "../application/yc-rhetorical-options";
import type { YcGroundingContext } from "../domain/yc-grounding.types";
import { lockedDiscourseFixtures } from "@/lib/ai/evals/grounded-discourse-report";
import { buildYcPlannedTool, resolveYcPlannedTool } from "./yc-planned-tool";
import { createYcApplicationMessage } from "./anthropic-yc.repository";
import { planSelection } from "@/modules/grounding/domain/rhetorical-plan";
function fixture() {
  const samples = lockedDiscourseFixtures.filter(
    (s) => s.category === "yc_application" && !s.expectedViolations.length,
  );
  const sources = samples.flatMap((s, i) =>
    s.sources.map((a) => ({ ...a, rootId: `root${i}` })),
  );
  const context: YcGroundingContext = {
    question: "Relevant experience?",
    questions: samples.map((_, i) => ({
      questionId: `q${i + 1}`,
      question: `Describe project ${i + 1}.`,
      sourceIds: [`root${i}`],
    })),
    jobDescription: "Synthetic evaluation work",
    atomicSources: sources,
    sources: samples.map((_, i) => ({
      id: `root${i}`,
      type: "evidence",
      label: "Synthetic",
      priority: 1,
      content: sources
        .filter((s) => s.rootId === `root${i}`)
        .map((s) => s.content)
        .join(" "),
    })),
    excludedClaims: [],
    readiness: { ready: true, missingFields: [], recommendedFields: [] },
    metadata: {
      profileFieldCount: 1,
      confirmedEvidenceCount: 5,
      resumeSource: "none",
    },
  };
  return buildYcPlannedOptions(context);
}
it("keeps five planned answers question-local, bounded and in one existing SDK call", async () => {
  const options = fixture();
  const create = vi.fn().mockResolvedValue({ content: [] });
  const tool = buildYcPlannedTool(options, true);
  expect(Buffer.byteLength(tool.description, "utf8")).toBeLessThan(26000);
  await createYcApplicationMessage({
    anthropic: { messages: { create } } as never,
    systemPrompt: "system",
    userPrompt: "user",
    questionCount: 5,
    plannedOptions: options,
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      max_tokens: 8000,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    }),
    { timeout: 30000, signal: expect.any(AbortSignal) },
  );
  const answers = options.map((q) => ({
    questionId: q.questionId,
    option_id: q.options[0]!.id,
    rhetorical_plan: planSelection(q.options[0]!.rhetoricalPlan),
  }));
  const response = (input: unknown) =>
    ({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: tool.name, input }],
    }) as never;
  expect(
    resolveYcPlannedTool(response({ answers }), options, true),
  ).toHaveLength(5);
  for (const bad of [
    answers.slice(1),
    [answers[0], answers[0], ...answers.slice(2)],
    answers.map((a, i) =>
      i === 0 ? { ...a, option_id: answers[1]!.option_id } : a,
    ),
    answers.map((a) => ({
      ...a,
      rhetorical_plan: { ...a.rhetorical_plan, sourceIds: ["other"] },
    })),
  ]) {
    expect(() =>
      resolveYcPlannedTool(response({ answers: bad }), options, true),
    ).toThrow();
  }
  expect(() =>
    resolveYcPlannedTool(
      { stop_reason: "max_tokens", content: [] } as never,
      options,
      true,
    ),
  ).toThrow();
});
