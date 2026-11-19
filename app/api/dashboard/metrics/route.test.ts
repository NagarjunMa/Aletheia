import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const user = vi.hoisted(() => vi.fn());
const load = vi.hoisted(() => vi.fn());
const db = { auth: { getUser: user } };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db }));
vi.mock("@/modules/dashboard/application/get-dashboard-metrics", () => ({
  getDashboardMetrics: load,
}));
import { GET } from "./route";
const request = (query = "") =>
  new NextRequest("https://example.test/api/dashboard/metrics" + query);
beforeEach(() => {
  vi.clearAllMocks();
  user.mockResolvedValue({
    data: { user: { id: "server-owner" } },
    error: null,
  });
  load.mockResolvedValue({ period: { days: 30 } });
});
it("authenticates before metrics and prevents shared caching", async () => {
  user.mockResolvedValue({ data: { user: null }, error: null });
  const response = await GET(request());
  expect(response.status).toBe(401);
  expect(load).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it.each([
  "?days=0",
  "?days=91",
  "?days=1.5",
  "?days=private",
  "?userId=another-owner",
])("rejects invalid periods and caller-selected owners %s", async (query) => {
  expect((await GET(request(query))).status).toBe(400);
  expect(load).not.toHaveBeenCalled();
});
it("uses the verified owner and a bounded non-default period", async () => {
  const response = await GET(request("?days=7"));
  expect(response.status).toBe(200);
  expect(load).toHaveBeenCalledExactlyOnceWith(db, "server-owner", 7);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it("does not return zero or leak raw errors during a data outage", async () => {
  load.mockRejectedValue(new Error("PRIVATE_DATABASE_CANARY"));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    code: "DASHBOARD_METRICS_UNAVAILABLE",
  });
});
