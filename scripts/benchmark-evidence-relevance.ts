/** Synthetic local selection benchmark. No database, provider or user data. */
import assert from "node:assert/strict";
import { candidateProfileInputSchema } from "../lib/candidate-profile/schema";
import { prepareFactReview } from "../lib/candidate-profile/fact-review";
import type { CandidateGroundingData } from "../modules/candidate-context/domain/candidate-context.types";
import { buildOutreachGroundingContext } from "../modules/outreach/application/build-outreach-grounding-context";
import { buildYcGroundingContext } from "../modules/application-answer/application/build-yc-grounding-context";

const topics = [
  "Policy",
  "Mentoring",
  "Accessibility",
  "Analytics",
  "Recruiting",
];
const candidate: CandidateGroundingData = {
  identity: { fullName: "Synthetic", linkedinUrl: "" },
  profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
  confirmedEvidence: Array.from({ length: 25 }, (_, index) => {
    const topic = topics[index % topics.length];
    const fact = `I delivered ${topic} improvements for operators.`;
    const record = {
      id: `synthetic-${index}`,
      kind: "technical_project" as const,
      title: `${topic} project ${index}`,
      context: "Synthetic context. ".repeat(50),
      actions: `${fact} ${"Synthetic detail. ".repeat(90)}`,
      outcome: `${topic} workflow. `.repeat(50),
      metrics: Array(8).fill("Synthetic measurement. ".repeat(10)) as string[],
      skills: [topic ?? ""],
      links: [],
      confirmed: true,
      sortOrder: index,
    };
    return {
      ...record,
      factReview: prepareFactReview(record, [
        {
          id: "11111111-1111-4111-8111-111111111111",
          kind: "action",
          excerpt: fact,
          confirmed: true,
        },
      ]),
    };
  }),
  resume: {
    text: "Synthetic engineering background. ".repeat(180),
    source: "user_resumes",
  },
};
const jd = "Build policy documentation workflows. ".repeat(50);
const workloads = {
  outreach: () =>
    buildOutreachGroundingContext({
      candidate,
      target: {
        category: "cold_email",
        profileMarkdown: "Engineering Manager working on policy documentation.",
        jobDescription: jd,
        conversationContext: "",
      },
    }),
  ycBatch: () =>
    buildYcGroundingContext({
      candidate,
      question: "Describe Policy experience.",
      questions: topics.map((topic) => `Describe ${topic} experience.`),
      jobDescription: jd,
    }),
};
const iterations = 250;
const p95BudgetMs = 10;
for (const [workload, run] of Object.entries(workloads)) {
  for (let i = 0; i < 50; i++) run();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const result = run();
  const p95 = samples[Math.ceil(iterations * 0.95) - 1] ?? Infinity;
  const sourceChars = result.sources.reduce(
    (sum, source) => sum + source.content.length,
    0,
  );
  process.stdout.write(
    JSON.stringify({
      workload,
      node: process.version,
      stories: 25,
      questions: workload === "ycBatch" ? 5 : 1,
      iterations,
      medianMs: samples[Math.floor(iterations / 2)],
      p95Ms: p95,
      sourceCount: result.sources.length,
      sourceChars,
      p95BudgetMs,
    }) + "\n",
  );
  assert.ok(
    p95 < p95BudgetMs,
    `${workload} exceeded the local selection p95 budget`,
  );
}
