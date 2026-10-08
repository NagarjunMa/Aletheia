import { describe, expect, it, vi } from "vitest";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import type { CandidateGroundingData } from "../domain/yc-grounding.types";
import { prepareYcGroundingContext } from "./prepare-yc-grounding-context";
import { createGenerationTiming } from "@/lib/generation-timing";

const caller = {
  accessToken: "verified-access-token",
  userId: "77777777-7777-4777-8777-777777777777",
};

const target = {
  question: "Why are you a strong candidate for this role?",
  jobDescription: "Build and operate TypeScript systems in a small team.",
};

function candidateData(
  overrides: Partial<CandidateGroundingData> = {},
): CandidateGroundingData {
  const candidate: CandidateGroundingData = {
    identity: { fullName: "", linkedinUrl: "" },
    profile: candidateProfileInputSchema.parse({
      currentRole: "Platform Engineer",
      startupMotivation: "I prefer small teams close to users.",
    }),
    confirmedEvidence: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "production_scale",
        title: "Production delivery",
        context: "A customer workflow needed better reliability.",
        actions: "Built and operated the TypeScript service.",
        outcome: "Shipped a maintained production workflow.",
        metrics: [],
        skills: ["TypeScript"],
        links: [],
        confirmed: true,
        sortOrder: 0,
      },
    ],
    resume: { text: "Server-owned resume text.", source: "user_resumes" },
    ...overrides,
  };
  candidate.confirmedEvidence = candidate.confirmedEvidence.map((record) => ({
    ...record,
    factReview: prepareFactReview(record, [
      {
        id: "88888888-8888-4888-8888-888888888888",
        kind: "action",
        excerpt: record.actions,
        confirmed: true,
      },
    ]),
  }));
  return candidate;
}

describe("prepareYcGroundingContext", () => {
  it("separates repository wait from context build without changing caller scope", async () => {
    let time = 0;
    const timing = createGenerationTiming(() => time);
    const loadCandidateData = vi.fn(async () => {
      time += 19;
      return candidateData();
    });
    await prepareYcGroundingContext(
      { caller, ...target, timing },
      {
        loadCandidateData,
        recordGrounding: () => {
          time += 2;
        },
      },
    );
    timing.enter("rateLimit");
    expect(timing.finish(200).stages).toMatchObject({
      groundingLoad: 19,
      groundingBuild: 2,
    });
    expect(loadCandidateData).toHaveBeenCalledWith(caller);
  });
  it("loads caller-scoped data, builds the context, and logs metadata only", async () => {
    const loadCandidateData = vi.fn().mockResolvedValue(candidateData());
    const recordGrounding = vi.fn();

    const result = await prepareYcGroundingContext(
      { caller, ...target },
      { loadCandidateData, recordGrounding },
    );

    expect(loadCandidateData).toHaveBeenCalledWith(caller);
    expect(result.readiness.ready).toBe(true);
    expect(recordGrounding).toHaveBeenCalledWith({
      sourceCounts: { evidence: 1, profile: 2, resume: 1 },
      readiness: {
        ready: true,
        missingFieldCount: 0,
        recommendedFieldCount: 3,
      },
    });

    const telemetry = JSON.stringify(recordGrounding.mock.calls);
    expect(telemetry).not.toContain(caller.userId);
    expect(telemetry).not.toContain(caller.accessToken);
    expect(telemetry).not.toContain(target.jobDescription);
    expect(telemetry).not.toContain("Server-owned resume text");
  });

  it("returns a stable readiness failure without a model, credit, or rate-limit dependency", async () => {
    const loadCandidateData = vi.fn().mockResolvedValue(
      candidateData({
        profile: candidateProfileInputSchema.parse({}),
        confirmedEvidence: [],
        resume: { text: "", source: "none" },
      }),
    );
    const recordGrounding = vi.fn();

    await expect(
      prepareYcGroundingContext(
        { caller, ...target },
        { loadCandidateData, recordGrounding },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        readiness: {
          ready: false,
          missingFields: ["current_role_or_resume", "confirmed_evidence"],
          recommendedFields: [
            "current_responsibilities",
            "technical_project_evidence",
            "startup_motivation",
            "ai_usage_evidence",
          ],
        },
      }),
    );
    expect(recordGrounding).toHaveBeenCalledWith({
      sourceCounts: { evidence: 0, profile: 0, resume: 0 },
      readiness: {
        ready: false,
        missingFieldCount: 2,
        recommendedFieldCount: 4,
      },
    });
  });
});
