import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createBearerServiceClient: () => db,
  createBearerAuthClient: vi.fn(),
}));
import {
  refundCreditReservation,
  releaseRateLimitReservation,
  recordApplicationRefundFailure,
} from "./extension-generate.repository";
const credit = {
  userId: "44444444-4444-4444-8444-444444444444",
  reservationId: "22222222-2222-4222-8222-222222222222",
  amount: 4,
};
beforeEach(() => vi.clearAllMocks());
describe("application compensation outcomes", () => {
  it("returns failure for resolved RPC errors, not only thrown errors", async () => {
    db.rpc.mockResolvedValue({
      data: null,
      error: { message: "PRIVATE_DATABASE_DETAIL" },
    });
    expect(await releaseRateLimitReservation(credit.userId)).toBe(false);
    expect(await refundCreditReservation(credit, "yc_output_invalid")).toBe(
      false,
    );
  });
  it.each([true, false])(
    "treats a confirmed idempotent refund (%s) as settled",
    async (refunded) => {
      db.rpc.mockResolvedValue({
        data: [{ refunded, balance: 40 }],
        error: null,
      });
      expect(await refundCreditReservation(credit, "yc_output_invalid")).toBe(
        true,
      );
      expect(db.rpc).toHaveBeenCalledTimes(1);
      expect(db.rpc).toHaveBeenCalledWith(
        "refund_generation_credits",
        expect.objectContaining({
          p_reservation_id: credit.reservationId,
          p_amount: 4,
        }),
      );
    },
  );
  it("stores a server-owned pending marker on the original debit, preserving metadata", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      abortSignal: vi.fn(),
      single: vi.fn(),
      update: vi.fn(),
    };
    for (const name of ["select", "eq", "abortSignal", "update"] as const)
      chain[name].mockReturnValue(chain);
    chain.single
      .mockResolvedValueOnce({
        data: { metadata: { reserved: true } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: credit.reservationId },
        error: null,
      });
    db.from.mockReturnValue(chain);
    expect(
      await recordApplicationRefundFailure(credit, "yc_output_invalid"),
    ).toBe(true);
    expect(db.from).toHaveBeenCalledWith("credit_ledger");
    expect(chain.eq).toHaveBeenCalledWith("user_id", credit.userId);
    expect(chain.eq).toHaveBeenCalledWith("reason", "generation_debit");
    expect(chain.update).toHaveBeenCalledWith({
      metadata: {
        reserved: true,
        refund_status: "pending_manual_review",
        refund_reason: "yc_output_invalid",
      },
    });
  });
  it("returns a record failure if the database is unavailable without issuing another refund", async () => {
    db.from.mockImplementation(() => {
      throw new Error("Database unavailable");
    });
    expect(await recordApplicationRefundFailure(credit, "model_timeout")).toBe(
      false,
    );
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
