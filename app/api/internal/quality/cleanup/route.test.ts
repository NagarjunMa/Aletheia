import { beforeEach, it, expect, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
const cleanup = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("@/lib/supabase/server", () => ({
  createStatelessServiceClient: service,
}));
vi.mock("@/lib/ai/quality-retention", () => ({
  cleanupQualityFeedback: cleanup,
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "a-secure-test-secret";
});
it("authenticates before creating a privileged client", async () => {
  for (const authorization of ["", "Bearer wrong"])
    expect(
      (await GET(makeRequest({ method: "GET", headers: { authorization } })))
        .status,
    ).toBe(401);
  expect(service).not.toHaveBeenCalled();
  delete process.env.CRON_SECRET;
  expect((await GET(makeRequest({ method: "GET" }))).status).toBe(503);
  expect(service).not.toHaveBeenCalled();
});
it.each([false, true])(
  "reports successful bounded cleanup and saturation=%s",
  async (saturated) => {
    cleanup.mockResolvedValue({ removed: saturated ? 500 : 1, saturated });
    const response = await GET(
      makeRequest({
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      removed: saturated ? 500 : 1,
      saturated,
    });
  },
);
it("does not return private provider errors", async () => {
  cleanup.mockRejectedValue(new Error("PRIVATE_STORAGE_CANARY"));
  const response = await GET(
    makeRequest({
      method: "GET",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE");
});
