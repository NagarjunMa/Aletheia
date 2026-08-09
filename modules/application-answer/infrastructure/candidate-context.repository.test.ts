import { describe, expect, it, vi } from "vitest";
import {
  CandidateContextRepositoryError,
  loadCandidateGroundingData,
} from "./candidate-context.repository";

const userId = "77777777-7777-4777-8777-777777777777";

const storedProfile = {
  user_id: userId,
  current_role: "Platform Engineer",
  current_responsibilities: "Own delivery and production reliability.",
  startup_motivation: "Prefer small teams close to users.",
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
};

const confirmedEvidence = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: userId,
  kind: "production_scale",
  title: "Production observability rollout",
  context: "Failures required manual investigation.",
  actions: "Built instrumentation and deployment checks for the service.",
  outcome: "Reduced the time needed to identify failing requests.",
  metrics: [],
  skills: ["TypeScript", "observability"],
  links: [],
  confirmed_at: "2026-08-01T12:00:00.000Z",
  sort_order: 1,
};

function makeClient(options?: {
  profile?: Record<string, unknown> | null;
  evidence?: Array<Record<string, unknown>>;
  primaryResume?: Record<string, unknown> | null;
  legacyProfile?: Record<string, unknown> | null;
  profileError?: unknown;
  evidenceError?: unknown;
  resumeError?: unknown;
  legacyError?: unknown;
}) {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: options?.profile === undefined ? storedProfile : options.profile,
    error: options?.profileError ?? null,
  });
  const profileEq = vi
    .fn()
    .mockReturnValue({ maybeSingle: profileMaybeSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  const secondEvidenceOrder = vi.fn().mockResolvedValue({
    data: options?.evidence ?? [confirmedEvidence],
    error: options?.evidenceError ?? null,
  });
  const firstEvidenceOrder = vi
    .fn()
    .mockReturnValue({ order: secondEvidenceOrder });
  const evidenceNot = vi.fn().mockReturnValue({ order: firstEvidenceOrder });
  const evidenceEq = vi.fn().mockReturnValue({ not: evidenceNot });
  const evidenceSelect = vi.fn().mockReturnValue({ eq: evidenceEq });

  const resumeMaybeSingle = vi.fn().mockResolvedValue({
    data:
      options?.primaryResume === undefined
        ? { parsed_text: "Primary server-owned resume." }
        : options.primaryResume,
    error: options?.resumeError ?? null,
  });
  const resumePrimaryEq = vi
    .fn()
    .mockReturnValue({ maybeSingle: resumeMaybeSingle });
  const resumeUserEq = vi.fn().mockReturnValue({ eq: resumePrimaryEq });
  const resumeSelect = vi.fn().mockReturnValue({ eq: resumeUserEq });

  const legacyMaybeSingle = vi.fn().mockResolvedValue({
    data: options?.legacyProfile ?? { resume: "Legacy profile resume." },
    error: options?.legacyError ?? null,
  });
  const legacyEq = vi.fn().mockReturnValue({ maybeSingle: legacyMaybeSingle });
  const legacySelect = vi.fn().mockReturnValue({ eq: legacyEq });

  const from = vi.fn((table: string) => {
    if (table === "candidate_profiles") return { select: profileSelect };
    if (table === "candidate_evidence") return { select: evidenceSelect };
    if (table === "user_resumes") return { select: resumeSelect };
    if (table === "profiles") return { select: legacySelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from },
    evidenceNot,
    evidenceEq,
    firstEvidenceOrder,
    secondEvidenceOrder,
    profileEq,
    resumeUserEq,
    resumePrimaryEq,
    legacyEq,
  };
}

function loadWithClient(client: ReturnType<typeof makeClient>) {
  const createCallerClient = vi.fn(() => client.client as never);

  return {
    createCallerClient,
    operation: loadCandidateGroundingData(
      { accessToken: "verified-access-token", userId },
      { createCallerClient },
    ),
  };
}

describe("loadCandidateGroundingData", () => {
  it("loads caller-owned profile, confirmed evidence, and primary resume in one operation", async () => {
    const client = makeClient();
    const { createCallerClient, operation } = loadWithClient(client);
    const result = await operation;

    expect(result.profile.currentRole).toBe("Platform Engineer");
    expect(result.confirmedEvidence).toHaveLength(1);
    expect(result.confirmedEvidence[0]).toEqual(
      expect.objectContaining({
        id: confirmedEvidence.id,
        confirmed: true,
        kind: "production_scale",
      }),
    );
    expect(result.resume).toEqual({
      text: "Primary server-owned resume.",
      source: "user_resumes",
    });
    expect(client.profileEq).toHaveBeenCalledWith("user_id", userId);
    expect(client.evidenceEq).toHaveBeenCalledWith("user_id", userId);
    expect(client.evidenceNot).toHaveBeenCalledWith("confirmed_at", "is", null);
    expect(client.resumeUserEq).toHaveBeenCalledWith("user_id", userId);
    expect(client.resumePrimaryEq).toHaveBeenCalledWith("is_primary", true);
    expect(client.legacyEq).toHaveBeenCalledWith("id", userId);
    expect(createCallerClient).toHaveBeenCalledWith("verified-access-token");
  });

  it("defensively excludes an unconfirmed row even if the database adapter returns it", async () => {
    const client = makeClient({
      evidence: [
        confirmedEvidence,
        {
          ...confirmedEvidence,
          id: "22222222-2222-4222-8222-222222222222",
          confirmed_at: null,
        },
      ],
    });

    const result = await loadWithClient(client).operation;

    expect(result.confirmedEvidence.map((entry) => entry.id)).toEqual([
      confirmedEvidence.id,
    ]);
  });

  it("returns defaults and a legacy fallback without manufacturing candidate data", async () => {
    const client = makeClient({
      profile: null,
      evidence: [],
      primaryResume: null,
      legacyProfile: { resume: "  Legacy profile resume.  " },
    });

    const result = await loadWithClient(client).operation;

    expect(result.profile.currentRole).toBe("");
    expect(result.confirmedEvidence).toEqual([]);
    expect(result.resume).toEqual({
      text: "Legacy profile resume.",
      source: "profiles",
    });
  });

  it("returns no resume when both server-owned sources are empty", async () => {
    const client = makeClient({
      primaryResume: { parsed_text: "  " },
      legacyProfile: { resume: "" },
    });

    await expect(loadWithClient(client).operation).resolves.toEqual(
      expect.objectContaining({ resume: { text: "", source: "none" } }),
    );
  });

  it.each([
    [
      "candidate profile",
      { profileError: { message: "private profile error" } },
    ],
    ["evidence", { evidenceError: { message: "private evidence error" } }],
    ["primary resume", { resumeError: { message: "private resume error" } }],
    ["legacy resume", { legacyError: { message: "private legacy error" } }],
  ])(
    "fails closed with a privacy-safe error when %s loading fails",
    async (_, options) => {
      const client = makeClient(options);

      const { operation } = loadWithClient(client);
      await expect(operation).rejects.toBeInstanceOf(
        CandidateContextRepositoryError,
      );
      await expect(operation).rejects.toThrow(
        "Could not load candidate grounding context",
      );
      await expect(operation).rejects.not.toThrow(/private/i);
    },
  );

  it("fails closed when the caller-scoped client cannot be created", async () => {
    const operation = loadCandidateGroundingData(
      { accessToken: "verified-access-token", userId },
      {
        createCallerClient: () => {
          throw new Error("private environment error");
        },
      },
    );

    await expect(operation).rejects.toBeInstanceOf(
      CandidateContextRepositoryError,
    );
    await expect(operation).rejects.not.toThrow(/private/i);
  });
});
