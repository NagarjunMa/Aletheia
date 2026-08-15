import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260815180105_add_yc_application_billing_category.sql",
  ),
  "utf8",
).toLowerCase();

describe("YC application billing category migration", () => {
  it("extends both the ledger constraint and atomic reservation allowlist", () => {
    expect(migrationSql).toContain(
      "drop constraint if exists credit_ledger_category_check",
    );
    expect(migrationSql).toMatch(
      /add constraint credit_ledger_category_check[\s\S]*?'yc_application'/,
    );
    expect(migrationSql).toMatch(
      /p_category not in \([\s\S]*?'yc_application'[\s\S]*?\)/,
    );
  });

  it("keeps the replacement RPC security-definer hardened", () => {
    const functionBlock = migrationSql.match(
      /create or replace function public\.reserve_generation_credits[\s\S]*?\$\$;/,
    )?.[0];

    expect(functionBlock).toBeDefined();
    expect(functionBlock).toContain("security definer");
    expect(functionBlock).toContain("set search_path = public, pg_temp");
    expect(migrationSql).toMatch(
      /revoke all on function public\.reserve_generation_credits\(uuid, text, integer\)[\s\S]*?from public, anon, authenticated;/,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.reserve_generation_credits\(uuid, text, integer\)[\s\S]*?to service_role;/,
    );
    expect(migrationSql).not.toMatch(
      /grant execute on function public\.reserve_generation_credits[\s\S]*?to authenticated/,
    );
  });
});
