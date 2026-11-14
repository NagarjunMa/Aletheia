import { z } from "zod";
import { createReceiptRepository } from "../infrastructure/refund-receipt.repository";
import { sendRefundEmail } from "../infrastructure/refund-email.repository";
import { renderRefundReceipt } from "./weekly-refund-digest.service";
export const deliveryConfigSchema = z.object({
  from: z.string().email().max(254),
  anchor: z.string().datetime({ offset: true }),
  apiKey: z.string().min(1),
});
export type DeliveryConfig = z.infer<typeof deliveryConfigSchema>;
/** This worker has no credit mutation capability. Mail outcomes cannot re-credit. */
export async function deliverRefundReceipts(
  config: DeliveryConfig,
  repository: Omit<
    ReturnType<typeof createReceiptRepository>,
    "clearExpiredPayloads"
  > = createReceiptRepository(),
  send = sendRefundEmail,
) {
  const startedAt = performance.now();
  deliveryConfigSchema.parse(config);
  let lateRefunds = 0;
  let lateRefundsMore = false;
  let preparationPending = true;
  for (let i = 0; i < 2; i++) {
    const result = await repository.prepare(config.anchor);
    // Each preparation returns a snapshot, not a delta. Do not double-count.
    lateRefunds = result.lateRefunds;
    lateRefundsMore = result.lateRefundsMore;
    preparationPending = !result.caughtUp;
    if (result.caughtUp) break;
  }
  await repository.expire();
  async function deliverOne(): Promise<
    "sent" | "uncertain" | "failed" | "empty"
  > {
    const claim = await repository.claim();
    if (!claim) return "empty";
    const { receipt, leaseId } = claim;
    let payload = claim.payload;
    if (!payload) {
      const to = await repository.recipient(receipt.user_id);
      if (!to) {
        await repository.finish(
          receipt.id,
          leaseId,
          null,
          "RECIPIENT_UNAVAILABLE",
        );
        return "failed";
      }
      const message = renderRefundReceipt({
        id: receipt.id,
        user_id: receipt.user_id,
        period_start: receipt.period_start,
        period_end: receipt.period_end,
        credits: receipt.credits,
        generation_count: receipt.generation_count,
      });
      payload = await repository.freeze(receipt.id, leaseId, {
        from: config.from,
        to: [to],
        ...message,
      });
    }
    try {
      const provider = await send(receipt.id, payload, config.apiKey);
      await repository.finish(receipt.id, leaseId, provider, null);
      return "sent";
    } catch {
      try {
        await repository.finish(receipt.id, leaseId, null, "EMAIL_UNCONFIRMED");
      } catch {
        /* Expired lease remains observable and conservatively recoverable. */
      }
      return "uncertain";
    }
  }
  const totals = { sent: 0, uncertain: 0, failed: 0 };
  let possiblyMore = true;
  for (let batch = 0; batch < 3; batch++) {
    // A batch has up to 23 seconds of sequential I/O on each parallel lane.
    if (performance.now() - startedAt >= 30_000) break;
    const results = await Promise.allSettled([
      deliverOne(),
      deliverOne(),
      deliverOne(),
    ]);
    let empty = false;
    let unconfirmed = false;
    for (const result of results) {
      if (result.status === "rejected") {
        totals.uncertain++;
        unconfirmed = true;
      } else if (result.value === "empty") {
        empty = true;
      } else {
        totals[result.value]++;
      }
    }
    if (unconfirmed) break;
    if (empty) {
      possiblyMore = preparationPending;
      break;
    }
  }
  return { ...totals, lateRefunds, lateRefundsMore, possiblyMore };
}
