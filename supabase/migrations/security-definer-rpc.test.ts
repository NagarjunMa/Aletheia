import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260607212225_harden_security_definer_rpc_permissions.sql",
  ),
  "utf8",
).toLowerCase();

const protectedFunctions = [
  "check_and_increment_rate_limit",
  "release_rate_limit_reservation",
  "increment_approved_count",
  "increment_rejected_count",
];

describe("security definer RPC hardening migration", () => {
  it.each(protectedFunctions)(
    "sets a fixed search_path for %s",
    (functionName) => {
      const createFunctionBlock = migrationSql.match(
        new RegExp(
          `create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`,
        ),
      )?.[0];

      expect(createFunctionBlock).toBeDefined();
      expect(createFunctionBlock).toContain("security definer");
      expect(createFunctionBlock).toContain(
        "set search_path = public, pg_temp",
      );
    },
  );

  it.each(protectedFunctions)(
    "revokes public and authenticated execution for %s",
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

  it("does not grant the protected RPCs to authenticated users", () => {
    expect(migrationSql).not.toMatch(
      /grant execute on function public\.(check_and_increment_rate_limit|release_rate_limit_reservation|increment_approved_count|increment_rejected_count)[\s\S]*?to authenticated/,
    );
  });
});
