import { describe, expect, it, vi } from "vitest";
import {
  applyCreditPurchase,
  CREDIT_PACKS,
  GENERATION_CREDIT_COSTS,
  getGenerationCreditCost,
  grantTrialCreditsOnce,
  isBillableGenerationCategory,
  isUnlimitedCreditUser,
  reserveGenerationCredits,
  refundGenerationCredits,
  TRIAL_CREDITS,
} from "./credits";

function createRpcClient(
  rpc: (_name: string, _args: Record<string, unknown>) => unknown,
) {
  const rpcMock = vi.fn(async (name: string, args: Record<string, unknown>) => {
    return rpc(name, args);
  });

  return {
    client: {
      rpc: rpcMock,
      from: vi.fn(),
    } as never,
    rpcMock,
  };
}

describe("credit billing rules", () => {
  it("defines the public-launch credit model", () => {
    expect(TRIAL_CREDITS).toBe(40);
    expect(GENERATION_CREDIT_COSTS.linkedin_connection).toBe(2);
    expect(GENERATION_CREDIT_COSTS.cold_email).toBe(4);
    expect(GENERATION_CREDIT_COSTS.linkedin_inmail).toBe(4);
    expect(CREDIT_PACKS.starter).toMatchObject({
      credits: 60,
      priceUsd: 5,
    });
    expect(CREDIT_PACKS.plus).toMatchObject({ credits: 100, priceUsd: 7 });
    expect(CREDIT_PACKS.pro).toMatchObject({ credits: 500, priceUsd: 20 });
  });

  it("recognizes only generation categories that consume credits", () => {
    expect(isBillableGenerationCategory("linkedin_connection")).toBe(true);
    expect(isBillableGenerationCategory("cold_email")).toBe(true);
    expect(isBillableGenerationCategory("linkedin_inmail")).toBe(true);
    expect(isBillableGenerationCategory("instagram_dm")).toBe(false);
  });

  it("returns server-side generation costs", () => {
    expect(getGenerationCreditCost("linkedin_connection")).toBe(2);
    expect(getGenerationCreditCost("cold_email")).toBe(4);
    expect(getGenerationCreditCost("linkedin_inmail")).toBe(4);
  });

  it("marks the development account as unlimited credit access", () => {
    expect(isUnlimitedCreditUser("nagarjunmallesh@gmail.com")).toBe(true);
    expect(isUnlimitedCreditUser("NagarjunMallesh@gmail.com")).toBe(true);
    expect(isUnlimitedCreditUser("user@example.com")).toBe(false);
    expect(isUnlimitedCreditUser(null)).toBe(false);
  });
});

describe("credit billing RPC wrappers", () => {
  it("grants trial credits through the one-time RPC", async () => {
    const { client, rpcMock } = createRpcClient(() => ({
      data: [{ granted: true, balance: 40 }],
      error: null,
    }));

    await expect(grantTrialCreditsOnce(client, "user-1")).resolves.toEqual({
      granted: true,
      balance: 40,
    });
    expect(rpcMock).toHaveBeenCalledWith("grant_trial_credits_once", {
      p_user_id: "user-1",
      p_amount: 40,
    });
  });

  it("reserves generation credits using category-derived costs", async () => {
    const { client, rpcMock } = createRpcClient(() => ({
      data: [
        {
          allowed: true,
          reservation_id: "reservation-1",
          balance_after: 36,
        },
      ],
      error: null,
    }));

    await expect(
      reserveGenerationCredits(client, "user-1", "cold_email"),
    ).resolves.toEqual({
      allowed: true,
      reservationId: "reservation-1",
      balanceAfter: 36,
      cost: 4,
    });
    expect(rpcMock).toHaveBeenCalledWith("reserve_generation_credits", {
      p_user_id: "user-1",
      p_category: "cold_email",
      p_cost: 4,
    });
  });

  it("surfaces insufficient credits without throwing", async () => {
    const { client } = createRpcClient(() => ({
      data: [
        {
          allowed: false,
          reservation_id: null,
          balance_after: 1,
        },
      ],
      error: null,
    }));

    await expect(
      reserveGenerationCredits(client, "user-1", "linkedin_connection"),
    ).resolves.toMatchObject({
      allowed: false,
      reservationId: null,
      balanceAfter: 1,
      cost: 2,
    });
  });

  it("refunds a reserved generation debit with metadata", async () => {
    const { client, rpcMock } = createRpcClient(() => ({
      data: [{ refunded: true, balance: 40 }],
      error: null,
    }));

    await expect(
      refundGenerationCredits(client, "user-1", "reservation-1", 4, {
        reason: "anthropic_timeout",
      }),
    ).resolves.toEqual({ refunded: true, balance: 40 });
    expect(rpcMock).toHaveBeenCalledWith("refund_generation_credits", {
      p_user_id: "user-1",
      p_reservation_id: "reservation-1",
      p_amount: 4,
      p_metadata: { reason: "anthropic_timeout" },
    });
  });

  it("applies purchases with idempotency metadata", async () => {
    const { client, rpcMock } = createRpcClient(() => ({
      data: [{ applied: true, balance: 540 }],
      error: null,
    }));

    await expect(
      applyCreditPurchase(client, "user-1", "pro", "cs_test_123", {
        source: "webhook",
      }),
    ).resolves.toEqual({ applied: true, balance: 540 });
    expect(rpcMock).toHaveBeenCalledWith("apply_credit_purchase", {
      p_user_id: "user-1",
      p_credits: 500,
      p_stripe_checkout_session_id: "cs_test_123",
      p_metadata: {
        pack: "pro",
        priceUsd: 20,
        source: "webhook",
      },
    });
  });

  it("throws when an RPC returns an error", async () => {
    const { client } = createRpcClient(() => ({
      data: null,
      error: { message: "database unavailable" },
    }));

    await expect(grantTrialCreditsOnce(client, "user-1")).rejects.toThrow(
      "grant_trial_credits_once failed: database unavailable",
    );
  });
});
