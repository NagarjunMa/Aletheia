import { timingSafeEqual } from "node:crypto";
import { adminJson } from "@/modules/refund-review/application/refund-admin-http";
import {
  deliverRefundReceipts,
  deliveryConfigSchema,
} from "@/modules/refund-review/application/deliver-refund-receipts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16)
    return adminJson({ error: "RECEIPTS_NOT_CONFIGURED" }, 503);
  const expected = Buffer.from(`Bearer ${secret}`),
    provided = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  )
    return adminJson({ error: "UNAUTHORIZED" }, 401);
  if (process.env.REFUND_RECEIPT_DELIVERY_ENABLED !== "true")
    return adminJson({ enabled: false });
  const config = deliveryConfigSchema.safeParse({
    from: process.env.REFUND_RECEIPT_FROM,
    anchor: process.env.REFUND_RECEIPT_ANCHOR,
    apiKey: process.env.RESEND_API_KEY,
  });
  if (!config.success)
    return adminJson({ error: "RECEIPTS_NOT_CONFIGURED" }, 503);
  try {
    return adminJson(await deliverRefundReceipts(config.data));
  } catch {
    return adminJson({ error: "RECEIPT_RUN_UNCONFIRMED" }, 503);
  }
}
