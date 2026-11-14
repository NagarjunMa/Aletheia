import { NextRequest } from "next/server";
import deploymentConfig from "@/vercel.json";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { worker, retain } = vi.hoisted(() => ({
  worker: vi.fn(),
  retain: vi.fn(),
}));
vi.mock(
  "@/modules/refund-review/infrastructure/refund-receipt.repository",
  () => ({
    createReceiptRepository: () => ({ clearExpiredPayloads: retain }),
  }),
);
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
  new NextRequest("http://localhost/api/internal/refunds/weekly-digest", {
    headers: { authorization: auth },
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  vi.stubEnv("REFUND_RECEIPT_DELIVERY_ENABLED", "false");
  vi.stubEnv("REFUND_RECEIPT_RETENTION_ENABLED", "false");
  worker.mockResolvedValue({ sent: 0 });
  retain.mockResolvedValue(200);
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

it("runs opted-in retention even with delivery disabled and no provider settings", async () => {
  vi.stubEnv("REFUND_RECEIPT_RETENTION_ENABLED", "true");
  expect((await GET(request("wrong"))).status).toBe(401);
  expect(retain).not.toHaveBeenCalled();
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    enabled: false,
    retention: { cleared: 200, possiblyMore: true },
  });
  expect(retain).toHaveBeenCalledTimes(1);
  expect(worker).not.toHaveBeenCalled();
});

it("reports retention failure without blocking configured receipt delivery", async () => {
  vi.stubEnv("REFUND_RECEIPT_RETENTION_ENABLED", "true");
  vi.stubEnv("REFUND_RECEIPT_DELIVERY_ENABLED", "true");
  vi.stubEnv("REFUND_RECEIPT_FROM", "receipts@example.com");
  vi.stubEnv("REFUND_RECEIPT_ANCHOR", "2026-09-07T00:00:00Z");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  retain.mockRejectedValueOnce(new Error("private failure"));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    sent: 0,
    retention: { error: "RECEIPT_RETENTION_UNCONFIRMED" },
  });
  expect(worker).toHaveBeenCalledTimes(1);
});

it("schedules three individually daily ticks within the provider deduplication window", () => {
  const refundCrons = deploymentConfig.crons.filter(
    ({ path }) => path === "/api/internal/refunds/weekly-digest",
  );
  expect(refundCrons.map(({ schedule }) => schedule)).toEqual([
    "17 4 * * *",
    "17 12 * * *",
    "17 20 * * *",
  ]);
});

it("still cleans up when enabled delivery is missing its provider config", async () => {
  vi.stubEnv("REFUND_RECEIPT_RETENTION_ENABLED", "true");
  vi.stubEnv("REFUND_RECEIPT_DELIVERY_ENABLED", "true");
  retain.mockResolvedValue(5);
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "RECEIPTS_NOT_CONFIGURED",
    retention: { cleared: 5, possiblyMore: false },
  });
  expect(worker).not.toHaveBeenCalled();
});
