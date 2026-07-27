import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  deleteCandidateEvidence,
  saveCandidateEvidence,
  saveCandidateProfileCategory,
} from "./actions";

const validProfile = {
  currentRole: "Platform Engineer",
  currentResponsibilities: "Own platform reliability and delivery.",
  startupMotivation: "I like small teams close to customers.",
  careerGoals: "Own products end to end.",
  targetRoles: ["Founding Engineer"],
  targetCompanyStages: ["seed" as const],
  targetIndustries: ["Developer tools"],
  githubUrl: "https://github.com/example",
  linkedinUrl: "",
  portfolioUrl: "",
  location: "New York",
  workAuthorization: "Authorized in the US",
  relocationPreference: "open" as const,
  availability: "Four weeks",
  excludedClaims: ["People management"],
};

const validEvidence = {
  kind: "technical_project" as const,
  title: "Release platform",
  context: "Deployments were manual.",
  actions: "Built a tested deployment workflow for the team.",
  outcome: "Releases became repeatable.",
  metrics: ["Hours to minutes"],
  skills: ["CI/CD"],
  links: ["https://github.com/example/release-platform"],
  confirmed: true,
  sortOrder: 1,
};

function mockAuthenticatedClient(from: ReturnType<typeof vi.fn>) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    from,
  });
}

describe("candidate application profile actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates profile input before opening a database session", async () => {
    const result = await saveCandidateProfileCategory("proof_links", {
      ...validProfile,
      githubUrl: "not a URL",
    });

    expect(result.ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated profile writes", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const result = await saveCandidateProfileCategory(
      "current_work",
      validProfile,
    );

    expect(result).toEqual({ ok: false, error: "Authentication required" });
  });

  it("saves only the selected dashboard category", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockAuthenticatedClient(vi.fn().mockReturnValue({ upsert }));

    const result = await saveCandidateProfileCategory(
      "current_work",
      validProfile,
    );

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        current_role: "Platform Engineer",
        current_responsibilities: "Own platform reliability and delivery.",
        schema_version: 1,
      },
      { onConflict: "user_id" },
    );
    expect(upsert.mock.calls[0]?.[0]).not.toHaveProperty("target_roles");
    expect(upsert.mock.calls[0]?.[0]).not.toHaveProperty("github_url");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects an unknown dashboard category before opening a database session", async () => {
    const result = await saveCandidateProfileCategory(
      "unknown" as never,
      validProfile,
    );

    expect(result.ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("inserts new evidence under the authenticated user", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockAuthenticatedClient(vi.fn().mockReturnValue({ insert }));

    const result = await saveCandidateEvidence(validEvidence);

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        kind: "technical_project",
        confirmed_at: expect.any(String),
      }),
    );
  });

  it("updates evidence only when both evidence and user IDs match", async () => {
    const userEq = vi.fn().mockResolvedValue({ error: null });
    const idEq = vi.fn().mockReturnValue({ eq: userEq });
    const update = vi.fn().mockReturnValue({ eq: idEq });
    mockAuthenticatedClient(vi.fn().mockReturnValue({ update }));

    const result = await saveCandidateEvidence({
      ...validEvidence,
      id: "0d8d57a9-771c-48c2-9d94-ce9a69ea4eac",
      confirmed: false,
    });

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed_at: null }),
    );
    expect(idEq).toHaveBeenCalledWith(
      "id",
      "0d8d57a9-771c-48c2-9d94-ce9a69ea4eac",
    );
    expect(userEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("deletes evidence only from the authenticated user's rows", async () => {
    const userEq = vi.fn().mockResolvedValue({ error: null });
    const idEq = vi.fn().mockReturnValue({ eq: userEq });
    const deleteRow = vi.fn().mockReturnValue({ eq: idEq });
    mockAuthenticatedClient(vi.fn().mockReturnValue({ delete: deleteRow }));

    const result = await deleteCandidateEvidence(
      "0d8d57a9-771c-48c2-9d94-ce9a69ea4eac",
    );

    expect(result).toEqual({ ok: true });
    expect(idEq).toHaveBeenCalledWith(
      "id",
      "0d8d57a9-771c-48c2-9d94-ce9a69ea4eac",
    );
    expect(userEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("returns a generic error without leaking database details", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: { message: "violates candidate_profiles_user_id_fkey" },
    });
    mockAuthenticatedClient(vi.fn().mockReturnValue({ upsert }));

    const result = await saveCandidateProfileCategory(
      "current_work",
      validProfile,
    );

    expect(result).toEqual({
      ok: false,
      error: "Could not save this profile category. Please try again.",
    });
  });
});
