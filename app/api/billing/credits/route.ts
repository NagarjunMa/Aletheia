import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  CREDIT_PACKS,
  ensureCreditAccount,
  grantTrialCreditsOnce,
} from "@/lib/billing/credits";
import { createLogger } from "@/lib/logger";

const log = createLogger("billing-credits");

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = await createServiceClient();
    await grantTrialCreditsOnce(service, user.id);
    const account = await ensureCreditAccount(service, user.id);

    const { data: ledger, error: ledgerError } = await service
      .from("credit_ledger")
      .select(
        "id, delta, balance_after, reason, category, stripe_checkout_session_id, metadata, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (ledgerError) {
      log.error(
        { err: ledgerError, userId: user.id.substring(0, 12) },
        "Failed to fetch credit ledger",
      );
      return NextResponse.json(
        { error: "Failed to fetch credits" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      balance: account.balance,
      lifetimeCreditsPurchased: account.lifetimeCreditsPurchased,
      lifetimeCreditsUsed: account.lifetimeCreditsUsed,
      trialCreditsGrantedAt: account.trialCreditsGrantedAt,
      creditExpiry: null,
      packs: Object.values(CREDIT_PACKS),
      ledger: ledger ?? [],
    });
  } catch (err) {
    log.error({ err }, "Credit summary endpoint failed");
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}
