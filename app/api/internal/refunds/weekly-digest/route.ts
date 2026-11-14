import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { adminJson } from "@/modules/refund-review/application/refund-admin-http";
import {
  deliverRefundReceipts,
  deliveryConfigSchema,
} from "@/modules/refund-review/application/deliver-refund-receipts";
import { createReceiptRepository } from "@/modules/refund-review/infrastructure/refund-receipt.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return withRequestLifecycle("refund-receipts", request, async (log) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 16)
      return adminJson({ error: "RECEIPTS_NOT_CONFIGURED" }, 503);
    const expected = Buffer.from(`Bearer ${secret}`);
    const provided = Buffer.from(request.headers.get("authorization") ?? "");
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    )
      return adminJson({ error: "UNAUTHORIZED" }, 401);

    const deliveryEnabled =
      process.env.REFUND_RECEIPT_DELIVERY_ENABLED === "true";
    const retentionEnabled =
      process.env.REFUND_RECEIPT_RETENTION_ENABLED === "true";
    const delivery = async () => {
      if (!deliveryEnabled) return { enabled: false };
      const config = deliveryConfigSchema.safeParse({
        from: process.env.REFUND_RECEIPT_FROM,
        anchor: process.env.REFUND_RECEIPT_ANCHOR,
        apiKey: process.env.RESEND_API_KEY,
      });
      if (!config.success) return { error: "RECEIPTS_NOT_CONFIGURED" };
      try {
        const result = await deliverRefundReceipts(config.data);
        const fields = { event: "refund_receipts.delivery", ...result };
        if (
          result.possiblyMore ||
          result.uncertain ||
          result.failed ||
          result.lateRefunds
        )
          log.warn(fields, "Refund receipt delivery needs follow-up");
        else log.info(fields, "Refund receipt delivery checked");
        return result;
      } catch {
        return { error: "RECEIPT_RUN_UNCONFIRMED" };
      }
    };
    const retention = async () => {
      if (!retentionEnabled) return undefined;
      try {
        const cleared = await createReceiptRepository().clearExpiredPayloads();
        const result = { cleared, possiblyMore: cleared === 200 };
        log.info(
          { event: "refund_receipts.retention", ...result },
          "Refund receipt retention checked",
        );
        return result;
      } catch {
        return { error: "RECEIPT_RETENTION_UNCONFIRMED" };
      }
    };
    const [delivered, retained] = await Promise.all([delivery(), retention()]);
    if ("error" in delivered)
      log.error(
        { event: "refund_receipts.delivery", errorCode: delivered.error },
        "Refund receipt delivery failed",
      );
    if (retained && "error" in retained)
      log.error(
        { event: "refund_receipts.retention", errorCode: retained.error },
        "Refund receipt retention failed",
      );
    const failed = "error" in delivered || (retained && "error" in retained);
    return adminJson(
      { ...delivered, ...(retained ? { retention: retained } : {}) },
      failed ? 503 : 200,
    );
  });
}
