import { describe, expect, it, vi } from "vitest";
import { loadCandidateGroundingData } from "./candidate-context.repository";

const userId = "77777777-7777-4777-8777-777777777777";

function clientWithRows() {
  const profile = {
    user_id: userId,
    current_role: "Platform Engineer",
    current_responsibilities: "",
    startup_motivation: "",
    career_goals: "",
    target_roles: [],
    target_company_stages: [],
    target_industries: [],
    github_url: "",
    linkedin_url: "https://linkedin.com/in/candidate",
    portfolio_url: "",
    location: "",
    work_authorization: "",
    relocation_preference: "open",
    availability: "",
    excluded_claims: [],
  };
  const evidence = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: userId,
    kind: "technical_project",
    title: "Owned project",
    context: "",
    actions: "Built a production service with clear ownership.",
    outcome: "",
    metrics: [],
    skills: [],
    links: [],
    confirmed_at: "2026-08-01T00:00:00.000Z",
    sort_order: 0,
  };
  const profileEq = vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  }));
  const evidenceOrder = vi.fn().mockResolvedValue({
    data: [
      evidence,
      {
        ...evidence,
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "other-user",
      },
    ],
    error: null,
  });
  const evidenceFirstOrder = vi.fn(() => ({ order: evidenceOrder }));
  const evidenceNot = vi.fn(() => ({ order: evidenceFirstOrder }));
  const evidenceEq = vi.fn(() => ({ not: evidenceNot }));
  const resumeUserEq = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { parsed_text: "Primary resume" },
        error: null,
      }),
    })),
  }));
  const legacyEq = vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue({
      data: { resume: "Legacy resume", full_name: "Candidate Name" },
      error: null,
    }),
  }));
  return {
    client: {
      from: (table: string) => {
        if (table === "candidate_profiles")
          return { select: () => ({ eq: profileEq }) };
        if (table === "candidate_evidence")
          return { select: () => ({ eq: evidenceEq }) };
        if (table === "user_resumes")
          return { select: () => ({ eq: resumeUserEq }) };
        return { select: () => ({ eq: legacyEq }) };
      },
    },
    profileEq,
    evidenceEq,
    resumeUserEq,
    legacyEq,
  };
}

describe("shared candidate-context repository", () => {
  it("keeps explicit ownership filters, filters cross-user rows, and returns identity", async () => {
    const fixture = clientWithRows();
    const result = await loadCandidateGroundingData(
      { userId, accessToken: "verified-token" },
      { createCallerClient: vi.fn(() => fixture.client as never) },
    );
    expect(fixture.profileEq).toHaveBeenCalledWith("user_id", userId);
    expect(fixture.evidenceEq).toHaveBeenCalledWith("user_id", userId);
    expect(fixture.resumeUserEq).toHaveBeenCalledWith("user_id", userId);
    expect(fixture.legacyEq).toHaveBeenCalledWith("id", userId);
    expect(result.confirmedEvidence).toHaveLength(1);
    expect(result.identity).toEqual({
      fullName: "Candidate Name",
      linkedinUrl: "https://linkedin.com/in/candidate",
    });
    expect(result.resume).toEqual({
      text: "Primary resume",
      source: "user_resumes",
    });
  });
});
