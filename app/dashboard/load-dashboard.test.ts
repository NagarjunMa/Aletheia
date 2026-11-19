import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
const metrics = vi.hoisted(() => vi.fn());
const candidate = vi.hoisted(() => vi.fn());
const resumes = vi.hoisted(() => vi.fn());
vi.mock("@/modules/dashboard/application/get-dashboard-metrics", () => ({
  getDashboardMetrics: metrics,
}));
vi.mock("@/lib/candidate-profile/service", () => ({
  getCandidateApplicationProfile: candidate,
}));
vi.mock("@/lib/resumes/service", () => ({ listUserResumes: resumes }));
import { loadDashboard } from "./load-dashboard";
beforeEach(() => {
  vi.clearAllMocks();
  metrics.mockResolvedValue({ activity: { requests: 5 } });
  candidate.mockResolvedValue({ profile: {}, evidence: [] });
  resumes.mockResolvedValue([]);
});
function database(failed = false) {
  const result = {
    data: failed ? null : [],
    error: failed ? { message: "PRIVATE_CANARY" } : null,
  };
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      ...result,
      data: failed ? null : { full_name: "Test owner" },
    })),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => result),
  };
  return {
    query,
    db: { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>,
  };
}
it("uses the verified caller for every server read", async () => {
  const { db, query } = database();
  const result = await loadDashboard(db, "owner-a");
  expect(metrics).toHaveBeenCalledWith(db, "owner-a");
  expect(candidate).toHaveBeenCalledWith(db, "owner-a");
  expect(resumes).toHaveBeenCalledWith(db, "owner-a");
  expect(query.eq.mock.calls).toEqual([
    ["id", "owner-a"],
    ["user_id", "owner-a"],
  ]);
  expect(result).toMatchObject({
    profileName: "Test owner",
    resumes: [],
    recent: [],
    metrics: { activity: { requests: 5 } },
  });
});
it("keeps failed sections unavailable rather than inventing empty records", async () => {
  metrics.mockRejectedValue(new Error("PRIVATE_CANARY"));
  candidate.mockRejectedValue(new Error("PRIVATE_CANARY"));
  resumes.mockRejectedValue(new Error("PRIVATE_CANARY"));
  const result = await loadDashboard(database(true).db, "owner-b");
  expect(result).toEqual({
    profileName: null,
    metrics: null,
    application: null,
    resumes: null,
    recent: null,
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE_CANARY");
});
it("keeps successful sections usable when metrics are unavailable", async () => {
  metrics.mockRejectedValue(new Error("Migration not applied"));
  const result = await loadDashboard(database().db, "owner-a");
  expect(result.metrics).toBeNull();
  expect(result.application).not.toBeNull();
  expect(result.resumes).toEqual([]);
});
