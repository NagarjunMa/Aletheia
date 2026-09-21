import { afterEach, beforeEach, expect, it, vi } from "vitest";
const worker = vi.hoisted(() => vi.fn());
vi.mock(
  "@/modules/refund-review/application/deliver-refund-receipts",
  async (original) => ({
    ...(await original<
      typeof import("@/modules/refund-review/application/deliver-refund-receipts")
    >()),
    deliverRefundReceipts: worker,
  }),
);
import { GET } from "./route";
const secret = "test-cron-secret-123456";
const request = (auth = `Bearer ${secret}`) =>
  new Request("http://localhost/api/internal/refunds/weekly-digest", {
    headers: { authorization: auth },
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  vi.stubEnv("REFUND_RECEIPT_DELIVERY_ENABLED", "false");
  worker.mockResolvedValue({ sent: 0 });
});
afterEach(() => vi.unstubAllEnvs());
it("requires the cron secret even when disabled", async () => {
  expect((await GET(request("wrong"))).status).toBe(401);
  expect(worker).not.toHaveBeenCalled();
});
it("stays inactive without explicit delivery enablement", async () => {
  expect(await (await GET(request())).json()).toEqual({ enabled: false });
  expect(worker).not.toHaveBeenCalled();
});
it("requires valid sender and reporting anchor", async () => {
  vi.stubEnv("REFUND_RECEIPT_DELIVERY_ENABLED", "true");
  expect((await GET(request())).status).toBe(503);
  expect(worker).not.toHaveBeenCalled();
});
it("passes only validated delivery configuration", async () => {
  vi.stubEnv("REFUND_RECEIPT_DELIVERY_ENABLED", "true");
  vi.stubEnv("REFUND_RECEIPT_FROM", "receipts@example.com");
  vi.stubEnv("REFUND_RECEIPT_ANCHOR", "2026-09-07T00:00:00Z");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  expect((await GET(request())).status).toBe(200);
  expect(worker).toHaveBeenCalledWith({
    from: "receipts@example.com",
    anchor: "2026-09-07T00:00:00Z",
    apiKey: "test-key",
  });
});
