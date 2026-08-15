import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";

export const CREDIT_BILLING_ENABLED =
  process.env.CREDIT_BILLING_ENABLED === "true";

const DEFAULT_UNLIMITED_CREDIT_EMAILS = ["nagarjunmallesh@gmail.com"];

export const TRIAL_CREDITS = 40;

export const GENERATION_CREDIT_COSTS = {
  linkedin_connection: 2,
  cold_email: 4,
  linkedin_inmail: 4,
  yc_application: 4,
} as const;

export type BillableGenerationCategory = keyof typeof GENERATION_CREDIT_COSTS;

export const CREDIT_PACKS = {
  starter: {
    id: "starter",
    name: "Starter",
    credits: 60,
    priceUsd: 5,
  },
  plus: {
    id: "plus",
    name: "Plus",
    credits: 100,
    priceUsd: 7,
  },
  pro: {
    id: "pro",
    name: "Pro",
    credits: 500,
    priceUsd: 20,
  },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export type CreditAccount = {
  balance: number;
  lifetimeCreditsPurchased: number;
  lifetimeCreditsUsed: number;
  trialCreditsGrantedAt: string | null;
};

export type CreditReservation = {
  allowed: boolean;
  reservationId: string | null;
  balanceAfter: number;
  cost: number;
};

function parseUnlimitedCreditEmails(): Set<string> {
  const configuredEmails = (process.env.CREDIT_BILLING_UNLIMITED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_UNLIMITED_CREDIT_EMAILS, ...configuredEmails]);
}

type BillingSupabaseClient = Pick<SupabaseClient<Database>, "rpc" | "from">;

function firstRow<T>(rows: T[] | null | undefined): T | null {
  return rows?.[0] ?? null;
}

function assertRpcResult<T>(
  rows: T[] | null,
  error: { message?: string } | null,
  rpcName: string,
): T {
  if (error) {
    throw new Error(`${rpcName} failed: ${error.message ?? "Unknown error"}`);
  }
  const row = firstRow(rows);
  if (!row) {
    throw new Error(`${rpcName} returned no rows`);
  }
  return row;
}

export function getGenerationCreditCost(
  category: BillableGenerationCategory,
): number {
  return GENERATION_CREDIT_COSTS[category];
}

export function isBillableGenerationCategory(
  category: string,
): category is BillableGenerationCategory {
  return category in GENERATION_CREDIT_COSTS;
}

export function isUnlimitedCreditUser(email: string | null | undefined) {
  if (!email) return false;
  return parseUnlimitedCreditEmails().has(email.trim().toLowerCase());
}

export async function ensureCreditAccount(
  supabase: BillingSupabaseClient,
  userId: string,
): Promise<CreditAccount> {
  const { data, error } = await supabase.rpc("ensure_credit_account", {
    p_user_id: userId,
  });
  const row = assertRpcResult(data, error, "ensure_credit_account");

  return {
    balance: row.balance,
    lifetimeCreditsPurchased: row.lifetime_credits_purchased,
    lifetimeCreditsUsed: row.lifetime_credits_used,
    trialCreditsGrantedAt: row.trial_credits_granted_at,
  };
}

export async function grantTrialCreditsOnce(
  supabase: BillingSupabaseClient,
  userId: string,
): Promise<{ granted: boolean; balance: number }> {
  const { data, error } = await supabase.rpc("grant_trial_credits_once", {
    p_user_id: userId,
    p_amount: TRIAL_CREDITS,
  });
  return assertRpcResult(data, error, "grant_trial_credits_once");
}

export async function reserveGenerationCredits(
  supabase: BillingSupabaseClient,
  userId: string,
  category: BillableGenerationCategory,
): Promise<CreditReservation> {
  const cost = getGenerationCreditCost(category);
  const { data, error } = await supabase.rpc("reserve_generation_credits", {
    p_user_id: userId,
    p_category: category,
    p_cost: cost,
  });
  const row = assertRpcResult(data, error, "reserve_generation_credits");

  return {
    allowed: row.allowed,
    reservationId: row.reservation_id,
    balanceAfter: row.balance_after,
    cost,
  };
}

export async function refundGenerationCredits(
  supabase: BillingSupabaseClient,
  userId: string,
  reservationId: string,
  amount: number,
  metadata: Json = {},
): Promise<{ refunded: boolean; balance: number }> {
  const { data, error } = await supabase.rpc("refund_generation_credits", {
    p_user_id: userId,
    p_reservation_id: reservationId,
    p_amount: amount,
    p_metadata: metadata,
  });
  return assertRpcResult(data, error, "refund_generation_credits");
}

export async function applyCreditPurchase(
  supabase: BillingSupabaseClient,
  userId: string,
  packId: CreditPackId,
  stripeCheckoutSessionId: string,
  metadata: Json = {},
): Promise<{ applied: boolean; balance: number }> {
  const pack = CREDIT_PACKS[packId];
  const { data, error } = await supabase.rpc("apply_credit_purchase", {
    p_user_id: userId,
    p_credits: pack.credits,
    p_stripe_checkout_session_id: stripeCheckoutSessionId,
    p_metadata: {
      pack: packId,
      priceUsd: pack.priceUsd,
      ...((metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata
        : {}) as Record<string, Json | undefined>),
    },
  });
  return assertRpcResult(data, error, "apply_credit_purchase");
}
