import { describe, expect, it, vi } from "vitest";
import { getCandidateApplicationProfile } from "./service";

function makeClient(options?: {
  profile?: Record<string, unknown> | null;
  evidence?: Array<Record<string, unknown>>;
  profileError?: { message: string } | null;
  evidenceError?: { message: string } | null;
}) {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: options?.profile ?? null,
    error: options?.profileError ?? null,
  });
  const profileEq = vi
    .fn()
    .mockReturnValue({ maybeSingle: profileMaybeSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  const secondOrder = vi.fn().mockResolvedValue({
    data: options?.evidence ?? [],
    error: options?.evidenceError ?? null,
  });
  const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
  const evidenceEq = vi.fn().mockReturnValue({ order: firstOrder });
  const evidenceSelect = vi.fn().mockReturnValue({ eq: evidenceEq });

  const from = vi.fn((table: string) => {
    if (table === "candidate_profiles") return { select: profileSelect };
    if (table === "candidate_evidence") return { select: evidenceSelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from },
    profileEq,
    evidenceEq,
    firstOrder,
    secondOrder,
  };
}

describe("getCandidateApplicationProfile", () => {
  it("returns defaults when the user has not started an application profile", async () => {
    const { client, profileEq, evidenceEq } = makeClient();

    const result = await getCandidateApplicationProfile(
      client as never,
      "user-123",
    );

    expect(result.profile.currentRole).toBe("");
    expect(result.profile.targetRoles).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(profileEq).toHaveBeenCalledWith("user_id", "user-123");
    expect(evidenceEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("maps stored rows into the domain model and orders evidence", async () => {
    const { client, firstOrder, secondOrder } = makeClient({
      profile: {
        user_id: "user-123",
        current_role: "Platform Engineer",
        current_responsibilities: "Own reliability and delivery.",
        startup_motivation: "Build close to users.",
        career_goals: "Own products end to end.",
        target_roles: ["Founding Engineer"],
        target_company_stages: ["seed"],
        target_industries: ["Developer tools"],
        github_url: "https://github.com/example",
        linkedin_url: "",
        portfolio_url: "",
        location: "New York",
        work_authorization: "US authorized",
        relocation_preference: "open",
        availability: "Four weeks",
        excluded_claims: ["People management"],
      },
      evidence: [
        {
          id: "0d8d57a9-771c-48c2-9d94-ce9a69ea4eac",
          user_id: "user-123",
          kind: "technical_project",
          title: "Release platform",
          context: "Deployments were manual.",
          actions: "Built a tested deployment workflow for the team.",
          outcome: "Releases became repeatable.",
          metrics: ["Hours to minutes"],
          skills: ["CI/CD"],
          links: [],
          confirmed_at: "2026-07-26T12:00:00.000Z",
          sort_order: 1,
        },
      ],
    });

    const result = await getCandidateApplicationProfile(
      client as never,
      "user-123",
    );

    expect(result.profile.currentRole).toBe("Platform Engineer");
    expect(result.profile.relocationPreference).toBe("open");
    expect(result.evidence[0]).toEqual(
      expect.objectContaining({
        kind: "technical_project",
        title: "Release platform",
        confirmed: true,
        sortOrder: 1,
      }),
    );
    expect(firstOrder).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
    expect(secondOrder).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });

  it("surfaces database failures instead of returning misleading empty data", async () => {
    const { client } = makeClient({
      profileError: { message: "database unavailable" },
    });

    await expect(
      getCandidateApplicationProfile(client as never, "user-123"),
    ).rejects.toThrow("Could not load application profile");
  });
});
