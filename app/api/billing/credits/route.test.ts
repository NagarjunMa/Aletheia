import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGrantTrialCreditsOnce = vi.hoisted(() => vi.fn());
const mockEnsureCreditAccount = vi.hoisted(() => vi.fn());
const mockIsUnlimitedCreditUser = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());
const mockLimit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/billing/credits", () => ({
  CREDIT_PACKS: {
    starter: { id: "starter", name: "Starter", credits: 60, priceUsd: 5 },
    plus: { id: "plus", name: "Plus", credits: 100, priceUsd: 7 },
    pro: { id: "pro", name: "Pro", credits: 500, priceUsd: 20 },
  },
  ensureCreditAccount: mockEnsureCreditAccount,
  grantTrialCreditsOnce: mockGrantTrialCreditsOnce,
  isUnlimitedCreditUser: mockIsUnlimitedCreditUser,
}));

import { GET } from "./route";

const MOCK_USER = {
  id: "user-uuid-1234",
  email: "user@example.com",
};

beforeEach(() => {
  mockGetUser.mockReset();
  mockGrantTrialCreditsOnce.mockReset();
  mockEnsureCreditAccount.mockReset();
  mockIsUnlimitedCreditUser.mockReset();
  mockFrom.mockReset();
  mockSelect.mockReset();
  mockEq.mockReset();
  mockOrder.mockReset();
  mockLimit.mockReset();

  mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  mockIsUnlimitedCreditUser.mockReturnValue(false);
  mockGrantTrialCreditsOnce.mockResolvedValue({ granted: true, balance: 40 });
  mockEnsureCreditAccount.mockResolvedValue({
    balance: 40,
    lifetimeCreditsPurchased: 0,
    lifetimeCreditsUsed: 0,
    trialCreditsGrantedAt: "2026-06-18T16:00:00.000Z",
  });
  mockLimit.mockResolvedValue({
    data: [
      {
        id: "ledger-1",
        delta: 40,
        balance_after: 40,
        reason: "trial_grant",
        category: null,
        stripe_checkout_session_id: null,
        metadata: { no_expiry: true },
        created_at: "2026-06-18T16:00:00.000Z",
      },
    ],
    error: null,
  });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("GET /api/billing/credits", () => {
  it("returns 401 when the user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "No session" },
    });

    const res = await GET(makeRequest({ method: "GET" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns the credit account, no-expiry packs, and recent ledger", async () => {
    const res = await GET(makeRequest({ method: "GET" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGrantTrialCreditsOnce).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
    );
    expect(mockEnsureCreditAccount).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
    );
    expect(mockFrom).toHaveBeenCalledWith("credit_ledger");
    expect(mockEq).toHaveBeenCalledWith("user_id", MOCK_USER.id);
    expect(body).toMatchObject({
      balance: 40,
      lifetimeCreditsPurchased: 0,
      lifetimeCreditsUsed: 0,
      creditExpiry: null,
      packs: [
        { id: "starter", credits: 60, priceUsd: 5 },
        { id: "plus", credits: 100, priceUsd: 7 },
        { id: "pro", credits: 500, priceUsd: 20 },
      ],
    });
    expect(body.ledger).toHaveLength(1);
  });

  it("returns unlimited developer access without mutating credit rows", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { ...MOCK_USER, email: "nagarjunmallesh@gmail.com" },
      },
      error: null,
    });
    mockIsUnlimitedCreditUser.mockReturnValue(true);

    const res = await GET(makeRequest({ method: "GET" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      billingMode: "unlimited_developer",
      unlimitedCredits: true,
      balance: null,
      creditExpiry: null,
      ledger: [],
    });
    expect(mockGrantTrialCreditsOnce).not.toHaveBeenCalled();
    expect(mockEnsureCreditAccount).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 500 when the ledger query fails", async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    const res = await GET(makeRequest({ method: "GET" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to fetch credits",
    });
  });

  it("returns 500 when credit account hydration fails", async () => {
    mockEnsureCreditAccount.mockRejectedValue(new Error("rpc unavailable"));

    const res = await GET(makeRequest({ method: "GET" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to fetch credits",
    });
  });
});
