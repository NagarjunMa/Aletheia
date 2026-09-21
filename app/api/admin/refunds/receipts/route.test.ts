import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));
vi.mock("@/lib/auth/refund-admin", async (original) => ({
  ...(await original<typeof import("@/lib/auth/refund-admin")>()),
  requireRefundAdmin: mocks.auth,
}));
vi.mock("@/lib/supabase/server", () => ({
  createStatelessServiceClient: mocks.client,
}));
import { RefundAdminError } from "@/lib/auth/refund-admin";
import { GET, POST } from "./route";
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/admin/refunds/receipts", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue("22222222-2222-4222-8222-222222222222");
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockReturnValue({ abortSignal: mocks.abortSignal });
  mocks.abortSignal.mockResolvedValue({
    data: { prepared: 1, possiblyMore: false, lateRefunds: 0 },
    error: null,
  });
});
it("denies both receipt endpoints before constructing the privileged client", async () => {
  mocks.auth.mockRejectedValue(new RefundAdminError(403, "DENIED"));
  expect((await GET(new Request("http://localhost/"))).status).toBe(403);
  expect((await POST(request({}))).status).toBe(403);
  expect(mocks.client).not.toHaveBeenCalled();
});
it("requires same origin and a closed seven-day period", async () => {
  const body = { start: "2026-08-03T00:00:00Z", end: "2026-08-10T00:00:00Z" };
  expect((await POST(request(body, "https://evil.example"))).status).toBe(403);
  expect(
    (await POST(request({ ...body, end: "2026-08-11T00:00:00Z" }))).status,
  ).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("prepares confirmed-credit receipts without invoking refunds or mail", async () => {
  const body = { start: "2026-08-03T00:00:00Z", end: "2026-08-10T00:00:00Z" };
  expect((await POST(request(body))).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("prepare_refund_receipts", {
    p_start: body.start,
    p_end: body.end,
  });
});
it("returns a safe error on persistence failure", async () => {
  mocks.abortSignal.mockResolvedValue({
    error: { message: "SECRET" },
    data: null,
  });
  const response = await GET(new Request("http://localhost/"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("SECRET");
});
