import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
const candidate = vi.hoisted(() => vi.fn());
const resumes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/candidate-profile/service", () => ({
  getCandidateApplicationProfile: candidate,
}));
vi.mock("@/lib/resumes/service", () => ({ listUserResumes: resumes }));
vi.mock(
  "@/modules/outreach/infrastructure/extension-generate.repository",
  () => ({ getDailyLimit: () => 17 }),
);
import { getDashboardMetrics } from "./get-dashboard-metrics";
const empty = {
  period: {
    days: 30,
    from: "2026-10-20T00:00:00Z",
    to: "2026-11-18T10:00:00Z",
    timeZone: "UTC",
  },
  coverage: {
    recordingStartedAt: "2026-11-18T00:00:00Z",
    availableFrom: "2026-11-18T00:00:00Z",
    capture: "best_effort",
  },
  activity: {
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    outputs: 0,
    providerAttempts: 0,
    unknownProviderRequests: 0,
    successRate: null,
    byCategory: [
      "linkedin_connection",
      "linkedin_inmail",
      "cold_email",
      "yc_application",
    ].map((category) => ({
      category,
      requests: 0,
      successes: 0,
      failures: 0,
      outputs: 0,
    })),
    daily: [],
  },
  reviews: {
    approved: 0,
    rejected: 0,
    approvalRate: null,
    rejectionReasons: [],
  },
  quota: { used: 3, resetAt: "2026-11-19T00:00:00Z" },
};
beforeEach(() => {
  vi.clearAllMocks();
  candidate.mockResolvedValue({
    profile: candidateProfileInputSchema.parse({}),
    evidence: [],
  });
  resumes.mockResolvedValue([]);
});
function database(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => ({ abortSignal: vi.fn(async () => result) }));
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}
it("uses the canonical non-default limit and caller-scoped profile reads", async () => {
  const db = database({ data: empty, error: null });
  const result = await getDashboardMetrics(db.client, "owner", 7);
  expect(db.rpc).toHaveBeenCalledWith("get_dashboard_metrics", { p_days: 7 });
  expect(candidate).toHaveBeenCalledWith(db.client, "owner");
  expect(resumes).toHaveBeenCalledWith(db.client, "owner");
  expect(result.quota).toMatchObject({ used: 3, limit: 17, remaining: 14 });
  expect(result.profile.nextStage).toBe("background");
});
it.each([
  { data: null, error: { message: "PRIVATE_FAILURE" } },
  { data: { ...empty, leakedSource: "PRIVATE_SOURCE" }, error: null },
])(
  "does not fabricate a successful empty response on failure",
  async (response) => {
    await expect(
      getDashboardMetrics(database(response).client, "owner"),
    ).rejects.toThrow();
  },
);
it("preserves a resume-service outage as unavailable data", async () => {
  resumes.mockRejectedValue(new Error("Resume lookup failed"));
  await expect(
    getDashboardMetrics(database({ data: empty, error: null }).client, "owner"),
  ).rejects.toThrow();
});
