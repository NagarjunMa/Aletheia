import { z } from "zod";
import { createStatelessServiceClient } from "@/lib/supabase/server";
import { receiptSchema } from "../domain/refund-receipt";
import {
  refundEmailPayloadSchema,
  type RefundEmailPayload,
} from "./refund-email.repository";
const claimedSchema = z.object({
  receipt: receiptSchema.passthrough(),
  leaseId: z.string().uuid(),
  payload: refundEmailPayloadSchema.nullable(),
});
export function createReceiptRepository() {
  const db = createStatelessServiceClient();
  return {
    async prepare(anchor: string) {
      const { data, error } = await db
        .rpc("prepare_next_refund_week", { p_anchor: anchor })
        .abortSignal(AbortSignal.timeout(3000));
      if (error) throw new Error("RECEIPT_PREPARE_FAILED");
      return z
        .object({
          caughtUp: z.boolean(),
          lateRefunds: z.number().int().min(0).max(100),
          lateRefundsMore: z.boolean(),
        })
        .parse(data);
    },
    async expire() {
      const { error } = await db
        .rpc("expire_refund_receipt_leases", {})
        .abortSignal(AbortSignal.timeout(3000));
      if (error) throw new Error("RECEIPT_RECOVERY_FAILED");
    },
    async claim() {
      const { data, error } = await db
        .rpc("claim_refund_receipt", {})
        .abortSignal(AbortSignal.timeout(3000));
      if (error) throw new Error("RECEIPT_CLAIM_FAILED");
      return data === null ? null : claimedSchema.parse(data);
    },
    async recipient(userId: string) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          db.auth.admin.getUserById(userId),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("AUTH_TIMEOUT")), 3000);
          }),
        ]);
        if (result.error || !result.data.user?.email_confirmed_at) return null;
        return z.string().email().max(254).parse(result.data.user.email);
      } catch {
        return null;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    async freeze(id: string, lease: string, payload: RefundEmailPayload) {
      const { data, error } = await db
        .rpc("freeze_refund_receipt_payload", {
          p_id: id,
          p_lease: lease,
          p_payload: payload,
        })
        .abortSignal(AbortSignal.timeout(3000));
      if (error) throw new Error("RECEIPT_FREEZE_FAILED");
      return refundEmailPayloadSchema.parse(data);
    },
    async finish(
      id: string,
      lease: string,
      provider: string | null,
      code: "EMAIL_UNCONFIRMED" | "RECIPIENT_UNAVAILABLE" | null,
    ) {
      const { data, error } = await db
        .rpc("finish_refund_receipt", {
          p_id: id,
          p_lease: lease,
          p_provider: provider,
          p_code: code,
        })
        .abortSignal(AbortSignal.timeout(3000));
      if (error || !data) throw new Error("RECEIPT_OUTCOME_UNCONFIRMED");
    },
  };
}
