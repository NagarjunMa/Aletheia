import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904054433_secure_resume_upload_pipeline.sql",
  ),
  "utf8",
).toLowerCase();

const serviceOnlyFunctions = [
  "mark_resume_upload_uploaded",
  "claim_resume_upload",
  "complete_resume_upload",
  "reject_resume_upload",
  "expire_resume_uploads",
];

describe("secure resume upload pipeline migration", () => {
  it("applies atomically with bounded lock and statement waits", () => {
    expect(migrationSql).toMatch(/^--[\s\S]*?begin;/);
    expect(migrationSql).toContain("set local lock_timeout = '5s'");
    expect(migrationSql).toContain("set local statement_timeout = '60s'");
    expect(migrationSql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("creates a private, bounded PDF and TXT quarantine bucket", () => {
    expect(migrationSql).toContain("'resume-quarantine'");
    expect(migrationSql).toContain("false,\n  5242880");
    expect(migrationSql).toContain("array['application/pdf', 'text/plain']");
  });

  it("creates the owner-scoped upload state model with bounded metadata", () => {
    expect(migrationSql).toContain("create table public.resume_uploads");
    expect(migrationSql).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade",
    );
    expect(migrationSql).toContain("storage_path text not null unique");
    expect(migrationSql).toContain("resume_uploads_declared_size_limit");
    expect(migrationSql).toContain("declared_size between 1 and 5242880");
    expect(migrationSql).toContain("resume_uploads_failure_code_safe");
    expect(migrationSql).toContain("resume_uploads_retry_count_limit");
    expect(migrationSql).toContain("retry_count between 0 and 3");
    expect(migrationSql).toContain("resume_uploads_terminal_timestamp");
    expect(migrationSql).toContain("resume_uploads_ready_metadata");
    expect(migrationSql).toContain("resume_uploads_failure_state_code");
    expect(migrationSql).toContain(
      "resume_id uuid unique references public.user_resumes(id) on delete cascade",
    );
  });

  it("indexes owner lookups, cleanup scans, and ready duplicate detection", () => {
    expect(migrationSql).toContain("resume_uploads_user_created_idx");
    expect(migrationSql).toContain("resume_uploads_user_active_idx");
    expect(migrationSql).toContain(
      "on public.resume_uploads (user_id, expires_at)",
    );
    expect(migrationSql).toContain("resume_uploads_expiry_idx");
    expect(migrationSql).toContain("on public.resume_uploads (expires_at, id)");
    expect(migrationSql).toContain("resume_uploads_user_ready_sha256_idx");
  });

  it("allows only explicit upload state transitions", () => {
    const functionBlock = migrationSql.match(
      /create or replace function public\.enforce_resume_upload_transition\(\)[\s\S]*?\$\$;/,
    )?.[0];

    expect(functionBlock).toBeDefined();
    expect(functionBlock).toContain(
      "old.state = 'reserved' and new.state in ('uploaded', 'canceled', 'expired')",
    );
    expect(functionBlock).toContain(
      "old.state = 'uploaded' and new.state in ('validating', 'canceled', 'expired')",
    );
    expect(functionBlock).toContain(
      "old.state = 'validating' and new.state in ('ready', 'rejected', 'failed', 'expired')",
    );
    expect(functionBlock).toContain(
      "old.state = 'failed' and new.state in ('validating', 'canceled', 'expired')",
    );
  });

  it("exposes only owner-scoped reservation metadata to authenticated users", () => {
    expect(migrationSql).toContain(
      "alter table public.resume_uploads enable row level security",
    );
    expect(migrationSql).toContain(
      'create policy "users can view own resume uploads"',
    );
    expect(migrationSql).toContain("for select\n  to authenticated");
    expect(migrationSql).toContain(
      "using ((select auth.uid()) is not null and (select auth.uid()) = user_id)",
    );
    expect(migrationSql).toContain(
      "revoke all on table public.resume_uploads from anon, authenticated",
    );
    expect(migrationSql).toContain(
      "grant select on table public.resume_uploads to authenticated",
    );
    expect(migrationSql).not.toMatch(
      /grant (insert|update|delete)[^;]*public\.resume_uploads[^;]*authenticated/,
    );
  });

  it("ties quarantine insertion to the caller's exact live reservation", () => {
    const policy = migrationSql.match(
      /create policy "users can upload exact reserved resume object"[\s\S]*?\n  \);/,
    )?.[0];

    expect(policy).toBeDefined();
    expect(policy).toContain("for insert");
    expect(policy).toContain("to authenticated");
    expect(policy).toContain("bucket_id = 'resume-quarantine'");
    expect(policy).toContain("owner_id = (select auth.uid())::text");
    expect(policy).toContain("upload.user_id = (select auth.uid())");
    expect(policy).toContain("upload.storage_path = name");
    expect(policy).toContain("upload.state = 'reserved'");
    expect(policy).toContain("upload.expires_at > now()");
  });

  it("does not grant authenticated quarantine reads, updates, or deletes", () => {
    const quarantinePolicies = Array.from(
      migrationSql.matchAll(/create policy[^;]+on storage\.objects[\s\S]*?;/g),
    )
      .map((match) => match[0])
      .filter((policy) => policy.includes("resume-quarantine"));

    expect(quarantinePolicies).toHaveLength(1);
    expect(quarantinePolicies[0]).toContain("for insert");
    expect(quarantinePolicies[0]).not.toMatch(/for (select|update|delete)/);
  });

  it("removes authenticated writes to the final resume bucket", () => {
    expect(migrationSql).toContain(
      'drop policy if exists "users can upload own resume files" on storage.objects',
    );
    expect(migrationSql).toContain(
      'drop policy if exists "users can update own resume files" on storage.objects',
    );
    const finalBucketWritePolicies = Array.from(
      migrationSql.matchAll(/create policy[\s\S]*?;/g),
    )
      .map((match) => match[0])
      .filter(
        (policy) =>
          policy.includes("on storage.objects") &&
          policy.includes("bucket_id = 'user-resumes'") &&
          /for (insert|update)/.test(policy),
      );

    expect(finalBucketWritePolicies).toHaveLength(0);
  });

  it("serializes reservation and completion limits per user", () => {
    expect(
      migrationSql.match(
        /hashtextextended\('resume-user:' \|\| v_user_id::text, 0\)/g,
      ),
    ).toHaveLength(2);
    expect(migrationSql).toContain(
      "state in ('reserved', 'uploaded', 'validating', 'failed')",
    );
    expect(migrationSql).toContain("if v_count >= 5 then");
    expect(migrationSql).toContain("if v_count >= 2 then");
    expect(migrationSql).toContain("if v_count >= 10 then");
    expect(migrationSql).toContain("now() - interval '1 hour'");
    expect(migrationSql).toContain("for update skip locked");
  });

  it("generates quarantine paths from the authenticated user and upload UUID", () => {
    const functionBlock = migrationSql.match(
      /create or replace function public\.reserve_resume_upload[\s\S]*?\$\$;/,
    )?.[0];

    expect(functionBlock).toBeDefined();
    expect(functionBlock).toContain("v_user_id uuid := auth.uid()");
    expect(functionBlock).toContain("v_upload_id uuid := gen_random_uuid()");
    expect(functionBlock).toContain(
      "v_user_id::text || '/' || v_upload_id::text || '.' || v_extension",
    );
    expect(functionBlock).not.toContain("p_storage_path");
  });

  it("makes completion atomic and dependent on a promoted final object", () => {
    const functionBlock = migrationSql.match(
      /create or replace function public\.complete_resume_upload[\s\S]*?\$\$;/,
    )?.[0];

    expect(functionBlock).toBeDefined();
    expect(functionBlock).toContain("from storage.objects as object");
    expect(functionBlock).toContain("object.bucket_id = 'user-resumes'");
    expect(functionBlock).toContain("object.name = v_upload.storage_path");
    expect(functionBlock).toContain("and user_id = p_user_id");
    expect(functionBlock).toContain("insert into public.user_resumes");
    expect(functionBlock).toContain("state = 'ready'");
    expect(functionBlock).toContain("content_sha256 = p_content_sha256");
  });

  it("acknowledges only a quarantine object that actually exists", () => {
    const functionBlock = migrationSql.match(
      /create or replace function public\.mark_resume_upload_uploaded[\s\S]*?\$\$;/,
    )?.[0];

    expect(functionBlock).toBeDefined();
    expect(functionBlock).toContain("from storage.objects as object");
    expect(functionBlock).toContain("object.bucket_id = 'resume-quarantine'");
    expect(functionBlock).toContain("object.name = v_upload.storage_path");
    expect(functionBlock).toContain("and user_id = p_user_id");
  });

  it("owner-binds every service lifecycle transition", () => {
    for (const functionName of [
      "mark_resume_upload_uploaded",
      "claim_resume_upload",
      "complete_resume_upload",
      "reject_resume_upload",
    ]) {
      const functionBlock = migrationSql.match(
        new RegExp(
          `create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`,
        ),
      )?.[0];

      expect(functionBlock).toBeDefined();
      expect(functionBlock).toContain("p_user_id uuid");
      expect(functionBlock).toContain("and user_id = p_user_id");
    }
  });

  it("renews a bounded lease whenever validation is claimed", () => {
    const functionBlock = migrationSql.match(
      /create or replace function public\.claim_resume_upload[\s\S]*?\$\$;/,
    )?.[0];

    expect(functionBlock).toBeDefined();
    expect(functionBlock).toContain("validation_started_at = now()");
    expect(functionBlock).toContain(
      "expires_at = greatest(upload.expires_at, now() + interval '15 minutes')",
    );
  });

  it.each(serviceOnlyFunctions)(
    "fixes search_path and restricts %s to service_role",
    (functionName) => {
      const functionBlock = migrationSql.match(
        new RegExp(
          `create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`,
        ),
      )?.[0];
      const revokeStatement = migrationSql.match(
        new RegExp(
          `revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon, authenticated, service_role;`,
        ),
      )?.[0];
      const grantStatement = migrationSql.match(
        new RegExp(
          `grant execute on function public\\.${functionName}[\\s\\S]*?to service_role;`,
        ),
      )?.[0];

      expect(functionBlock).toBeDefined();
      expect(functionBlock).toContain("security definer");
      expect(functionBlock).toContain("set search_path = public, pg_temp");
      expect(revokeStatement).toBeDefined();
      expect(grantStatement).toBeDefined();
    },
  );

  it("restricts user-callable RPCs to authenticated owners", () => {
    for (const functionName of [
      "reserve_resume_upload",
      "cancel_resume_upload",
    ]) {
      const functionBlock = migrationSql.match(
        new RegExp(
          `create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$;`,
        ),
      )?.[0];

      expect(functionBlock).toBeDefined();
      expect(functionBlock).toContain("security definer");
      expect(functionBlock).toContain("set search_path = public, pg_temp");
      expect(functionBlock).toContain("auth.uid()");
    }

    expect(migrationSql).toMatch(
      /grant execute on function public\.reserve_resume_upload[^;]+to authenticated;/,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.cancel_resume_upload[^;]+to authenticated;/,
    );
  });
});
