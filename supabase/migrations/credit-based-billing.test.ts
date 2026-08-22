import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260618164022_credit_based_billing.sql",
  ),
  "utf8",
).toLowerCase();

const protectedFunctions = [
  "ensure_credit_account",
  "grant_trial_credits_once",
  "reserve_generation_credits",
  "refund_generation_credits",
  "apply_credit_purchase",
];

describe("credit-based billing migration", () => {
  it("applies atomically with bounded lock and statement waits", () => {
    expect(migrationSql).toMatch(/^--[\s\S]*?begin;/);
    expect(migrationSql).toContain("set local lock_timeout = '5s'");
    expect(migrationSql).toContain("set local statement_timeout = '60s'");
    expect(migrationSql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("creates the public-launch credit model", () => {
    expect(migrationSql).toContain("default 40");
    expect(migrationSql).toContain("'linkedin_connection'");
    expect(migrationSql).toContain("'cold_email'");
    expect(migrationSql).toContain("'linkedin_inmail'");
    expect(migrationSql).toContain("'trial_grant'");
    expect(migrationSql).toContain("'generation_debit'");
    expect(migrationSql).toContain("'generation_refund'");
    expect(migrationSql).toContain("'purchase'");
  });

  it("enables RLS on credit tables and only exposes owner SELECT policies", () => {
    const policyBlocks = Array.from(
      migrationSql.matchAll(/create policy[\s\S]*?;/g),
    ).map((match) => match[0]);

    expect(migrationSql).toContain(
      "alter table public.user_credit_accounts enable row level security",
    );
    expect(migrationSql).toContain(
      "alter table public.credit_ledger enable row level security",
    );
    expect(policyBlocks).toHaveLength(2);
    expect(policyBlocks).toEqual(
      expect.arrayContaining([
        expect.stringContaining("on public.user_credit_accounts"),
        expect.stringContaining("on public.credit_ledger"),
      ]),
    );
    expect(policyBlocks.every((block) => block.includes("for select"))).toBe(
      true,
    );
    expect(
      policyBlocks.every((block) => block.includes("to authenticated")),
    ).toBe(true);
    expect(
      policyBlocks.every((block) =>
        block.includes("using ((select auth.uid()) = user_id)"),
      ),
    ).toBe(true);
    expect(migrationSql).toContain("for select");
    expect(migrationSql).toContain("to authenticated");
    expect(migrationSql).toContain("using ((select auth.uid()) = user_id)");
  });

  it("removes default client table grants before restoring authenticated SELECT", () => {
    expect(migrationSql).toMatch(
      /revoke all on table public\.user_credit_accounts, public\.credit_ledger[\s\S]*?from anon, authenticated;/,
    );
    expect(migrationSql).toContain(
      "grant select on public.user_credit_accounts to authenticated",
    );
    expect(migrationSql).toContain(
      "grant select on public.credit_ledger to authenticated",
    );
  });

  it("qualifies wallet columns that overlap RETURNS TABLE output names", () => {
    expect(migrationSql).toContain(
      "update public.user_credit_accounts as account",
    );
    expect(migrationSql).toContain("balance = account.balance + p_amount");
    expect(migrationSql).toContain("balance = account.balance - p_cost");
    expect(migrationSql).toContain("balance = account.balance + p_credits");
    expect(migrationSql).toContain(
      "lifetime_credits_used = greatest(account.lifetime_credits_used - p_amount, 0)",
    );
    expect(migrationSql).toContain("select account.balance into v_balance");
  });

  it("enforces one trial grant and idempotent purchase/refund ledgers", () => {
    expect(migrationSql).toContain("idx_credit_ledger_trial_once");
    expect(migrationSql).toContain("where reason = 'trial_grant'");
    expect(migrationSql).toContain("idx_credit_ledger_purchase_session_once");
    expect(migrationSql).toContain(
      "where stripe_checkout_session_id is not null",
    );
    expect(migrationSql).toContain("idx_credit_ledger_refund_once");
    expect(migrationSql).toContain("where reason = 'generation_refund'");
  });

  it.each(protectedFunctions)(
    "sets a fixed search_path for %s",
    (functionName) => {
      const functionBlock = migrationSql.match(
        new RegExp(
          `create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`,
        ),
      )?.[0];

      expect(functionBlock).toBeDefined();
      expect(functionBlock).toContain("security definer");
      expect(functionBlock).toContain("set search_path = public, pg_temp");
    },
  );

  it.each(protectedFunctions)(
    "revokes public, anon, and authenticated execution for %s",
    (functionName) => {
      const revokeStatement = migrationSql.match(
        new RegExp(
          `revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon, authenticated;`,
        ),
      )?.[0];

      expect(revokeStatement).toBeDefined();
    },
  );

  it.each(protectedFunctions)(
    "grants execution only back to service_role for %s",
    (functionName) => {
      const grantStatement = migrationSql.match(
        new RegExp(
          `grant execute on function public\\.${functionName}[\\s\\S]*?to service_role;`,
        ),
      )?.[0];

      expect(grantStatement).toBeDefined();
    },
  );

  it("does not grant protected credit RPCs to authenticated users", () => {
    expect(migrationSql).not.toMatch(
      /grant execute on function public\.(ensure_credit_account|grant_trial_credits_once|reserve_generation_credits|refund_generation_credits|apply_credit_purchase)[\s\S]*?to authenticated/,
    );
  });
});
