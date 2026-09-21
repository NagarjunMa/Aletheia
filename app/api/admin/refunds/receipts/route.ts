import { z } from "zod";
import { requireRefundAdmin } from "@/lib/auth/refund-admin";
import { createStatelessServiceClient } from "@/lib/supabase/server";
import {
  adminError,
  adminJson,
  requireSameOrigin,
  readReviewBody,
} from "@/modules/refund-review/application/refund-admin-http";
import { receiptPeriodSchema } from "@/modules/refund-review/domain/refund-receipt";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireRefundAdmin();
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(new URL(request.url).searchParams.get("offset") ?? 0);
    const { data, error } = await createStatelessServiceClient()
      .rpc("list_refund_receipts", { p_offset: offset })
      .abortSignal(AbortSignal.timeout(3000));
    if (error) throw new Error();
    return adminJson(data);
  } catch (error) {
    return adminError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireRefundAdmin();
    const period = receiptPeriodSchema.parse(await readReviewBody(request));
    if (Date.parse(period.end) > Date.now())
      return adminJson({ error: "PERIOD_NOT_CLOSED" }, 400);
    const { data, error } = await createStatelessServiceClient()
      .rpc("prepare_refund_receipts", {
        p_start: period.start,
        p_end: period.end,
      })
      .abortSignal(AbortSignal.timeout(3000));
    if (error) throw new Error();
    return adminJson(data);
  } catch (error) {
    return adminError(error);
  }
}
