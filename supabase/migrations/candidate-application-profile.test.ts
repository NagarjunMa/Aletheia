import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260726233739_create_candidate_application_profile.sql",
  ),
  "utf8",
).toLowerCase();

const tables = ["candidate_profiles", "candidate_evidence"];

describe("candidate application profile migration", () => {
  it("creates a compact profile plus repeatable evidence model", () => {
    expect(migrationSql).toContain("create table public.candidate_profiles");
    expect(migrationSql).toContain("create table public.candidate_evidence");
    expect(migrationSql).toContain(
      "user_id uuid primary key references public.profiles(id) on delete cascade",
    );
    expect(migrationSql).toContain(
      "user_id uuid not null references public.profiles(id) on delete cascade",
    );
    expect(migrationSql).toContain("candidate_evidence_kind_check");
    expect(migrationSql).toContain("candidate_evidence_actions_length_check");
  });

  it("indexes evidence ownership and common ordered reads", () => {
    expect(migrationSql).toContain(
      "create index candidate_evidence_user_order_idx",
    );
    expect(migrationSql).toContain(
      "on public.candidate_evidence (user_id, sort_order, created_at)",
    );
  });

  it("bounds repeatable payloads and constrains target stages at the database boundary", () => {
    expect(migrationSql).toContain(
      "candidate_profiles_target_roles_payload_check",
    );
    expect(migrationSql).toContain(
      "candidate_profiles_target_industries_payload_check",
    );
    expect(migrationSql).toContain(
      "candidate_profiles_excluded_claims_payload_check",
    );
    expect(migrationSql).toContain("candidate_evidence_metrics_payload_check");
    expect(migrationSql).toContain("candidate_evidence_skills_payload_check");
    expect(migrationSql).toContain("candidate_evidence_links_payload_check");
    expect(migrationSql).toContain("target_company_stages <@ array[");
  });

  it.each(tables)("enables RLS and owner-only CRUD on %s", (table) => {
    expect(migrationSql).toContain(
      `alter table public.${table} enable row level security`,
    );

    for (const operation of ["select", "insert", "update", "delete"]) {
      const policy = migrationSql.match(
        new RegExp(
          `create policy [^;]+ on public\\.${table}[^;]+for ${operation}[^;]+;`,
        ),
      )?.[0];

      expect(policy, `${table} ${operation} policy`).toBeDefined();
      expect(policy).toContain("to authenticated");
      if (operation !== "insert") {
        expect(policy).toContain("using ((select auth.uid()) = user_id)");
      }
      if (operation === "insert" || operation === "update") {
        expect(policy).toContain("with check ((select auth.uid()) = user_id)");
      }
    }
  });

  it("uses explicit least-privilege Data API grants", () => {
    for (const table of tables) {
      expect(migrationSql).toContain(
        `revoke all on table public.${table} from anon`,
      );
      expect(migrationSql).toContain(
        `grant select, insert, update, delete on table public.${table} to authenticated`,
      );
    }
  });

  it("caps evidence rows without introducing a security-definer function", () => {
    expect(migrationSql).toContain(
      "create function public.enforce_candidate_evidence_limit()",
    );
    expect(migrationSql).toContain("if evidence_count >= 25 then");
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toContain(
      "revoke all on function public.enforce_candidate_evidence_limit() from public, anon, authenticated",
    );
  });

  it("keeps updated_at current for both tables", () => {
    expect(migrationSql).toContain("execute function public.set_updated_at()");
    expect(
      migrationSql.match(/execute function public\.set_updated_at\(\)/g),
    ).toHaveLength(2);
  });
});
