import { expect, it } from "vitest";
import { profileProgress } from "./dashboard-metrics";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";

const profile = candidateProfileInputSchema.parse({});
function story(id: string): CandidateEvidenceRecord {
  const evidence: CandidateEvidenceRecord = {
    id,
    kind: "technical_project",
    title: "Synthetic project",
    context: "",
    actions: "I built TypeScript tools.",
    outcome: "",
    skills: [],
    metrics: [],
    links: [],
    confirmed: true,
    sortOrder: 0,
  };
  return {
    ...evidence,
    factReview: prepareFactReview(evidence, [
      {
        id: "77777777-7777-4777-8777-777777777777",
        kind: "action",
        excerpt: evidence.actions,
        confirmed: true,
      },
    ]),
  };
}
it("reports a real empty profile with the next required action", () => {
  expect(profileProgress({ profile, evidence: [] }, false)).toMatchObject({
    ready: false,
    completionPercent: 0,
    nextStage: "background",
    actionUrl: "/profile/application",
  });
});
it("preserves optional resume alternatives and excludes stale reviewed facts", () => {
  const role = { ...profile, currentRole: "Engineer" };
  const evidence = [
    story("11111111-1111-4111-8111-111111111111"),
    story("22222222-2222-4222-8222-222222222222"),
  ];
  expect(profileProgress({ profile: role, evidence }, false).ready).toBe(true);
  const changed = [
    evidence[0]!,
    { ...evidence[1]!, actions: "I changed the original project." },
  ];
  expect(
    profileProgress({ profile: role, evidence: changed }, false),
  ).toMatchObject({
    ready: false,
    nextStage: "reviewed_evidence",
  });
  expect(profileProgress({ profile, evidence }, true).ready).toBe(true);
});
