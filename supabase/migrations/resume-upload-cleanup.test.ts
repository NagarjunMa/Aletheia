import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260906120000_resume_upload_cleanup_leases.sql",
);

describe("resume upload cleanup lease migration", () => {
  const sql = () => fs.readFileSync(migrationPath, "utf8");

  it("adds retryable cleanup lease and completion timestamps", () => {
    expect(sql()).toContain("quarantine_cleanup_claimed_at");
    expect(sql()).toContain("quarantine_cleaned_at");
    expect(sql()).toContain("INTERVAL '15 minutes'");
  });

  it("claims terminal rows and ready rows with possible quarantine remnants", () => {
    const contents = sql();
    expect(contents).toContain(
      "state IN ('expired', 'rejected', 'canceled', 'ready')",
    );
    expect(contents).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("keeps cleanup RPCs service-role only", () => {
    const contents = sql();
    expect(contents).toContain(
      "REVOKE ALL ON FUNCTION public.expire_resume_uploads(INTEGER)",
    );
    expect(contents).toContain(
      "REVOKE ALL ON FUNCTION public.mark_resume_uploads_cleaned(UUID[])",
    );
    expect(contents).toContain(
      "GRANT EXECUTE ON FUNCTION public.mark_resume_uploads_cleaned(UUID[])\n  TO service_role",
    );
    expect(contents).toContain("quarantine_cleanup_claimed_at IS NOT NULL");
    expect(contents).toContain("AND quarantine_cleaned_at IS NOT NULL");
  });
});
