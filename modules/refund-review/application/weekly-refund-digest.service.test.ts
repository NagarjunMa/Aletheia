import { expect, it } from "vitest";
import { renderRefundReceipt } from "./weekly-refund-digest.service";
import { receiptPeriodSchema } from "../domain/refund-receipt";
it("summarizes confirmed credits without internal or generation content", () => {
  const receipt = {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "33333333-3333-4333-8333-333333333333",
    period_start: "2026-09-07T00:00:00Z",
    period_end: "2026-09-14T00:00:00Z",
    credits: 8,
    generation_count: 2,
  };
  const result = renderRefundReceipt(receipt);
  expect(result.text).toContain("8 application credits");
  expect(result.text).toContain("2 failed generations");
  expect(result.text).not.toContain(receipt.user_id);
  expect(() => renderRefundReceipt({ ...receipt, credits: 0 })).toThrow();
  expect(() =>
    renderRefundReceipt({ ...receipt, note: "PRIVATE" } as typeof receipt),
  ).toThrow();
});
it("rejects partial, inverted or invalid periods", () => {
  expect(
    receiptPeriodSchema.safeParse({
      start: "2026-09-07T00:00:00Z",
      end: "2026-09-14T00:00:00Z",
    }).success,
  ).toBe(true);
  for (const end of ["2026-09-08T00:00:00Z", "2026-09-06T00:00:00Z", "bad"])
    expect(
      receiptPeriodSchema.safeParse({ start: "2026-09-07T00:00:00Z", end })
        .success,
    ).toBe(false);
});
