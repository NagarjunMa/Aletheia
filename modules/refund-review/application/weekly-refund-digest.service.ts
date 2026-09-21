import { receiptSchema, type RefundReceipt } from "../domain/refund-receipt";
export function renderRefundReceipt(input: RefundReceipt) {
  const receipt = receiptSchema.parse(input);
  return {
    subject: "Your restored Aletheia credits",
    text: `${receipt.credits} application credits were restored for ${receipt.generation_count} failed generation${receipt.generation_count === 1 ? "" : "s"} during ${receipt.period_start.slice(0, 10)} through ${receipt.period_end.slice(0, 10)} (end exclusive). These credits are already available in your account. This is a restoration of deducted application credits, not a weekly allowance reset.`,
  };
}
