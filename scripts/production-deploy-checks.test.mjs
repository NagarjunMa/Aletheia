import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  parseMigrationHistory,
  validateMigrationHistory,
  validateProductionAppTarget,
  validateProjectRef,
} from "./production-deploy-checks.mjs";

test("requires a valid production Supabase project reference", () => {
  assert.doesNotThrow(() => validateProjectRef("abc12fghij345mnopqrs"));
  assert.throws(() => validateProjectRef(""), /missing or invalid/);
  assert.throws(
    () => validateProjectRef("wrong-project"),
    /missing or invalid/,
  );
});

test("requires the live app and migration job to target the same Supabase project", () => {
  const projectRef = "abc12fghij345mnopqrs";
  assert.doesNotThrow(() =>
    validateProductionAppTarget(
      JSON.stringify({
        status: "ok",
        supabaseOrigin: `https://${projectRef}.supabase.co`,
      }),
      projectRef,
    ),
  );
  assert.throws(
    () =>
      validateProductionAppTarget(
        JSON.stringify({
          status: "ok",
          supabaseOrigin: "https://differentproject123.supabase.co",
        }),
        projectRef,
      ),
    /does not match/,
  );
  assert.throws(
    () => validateProductionAppTarget("not-json", projectRef),
    /not valid JSON/,
  );
});

test("fails closed when production migration history has no baseline", () => {
  const history = parseMigrationHistory(
    "LOCAL │ REMOTE │ TIME (UTC)\n20261007224520 │ │ 2026-10-07",
  );
  assert.throws(() => validateMigrationHistory(history, "pre"), /baseline/);
});

test("allows only migrations newer than the applied baseline", () => {
  const history = parseMigrationHistory(
    "│ LOCAL │ REMOTE │ TIME (UTC) │\n│ 20260921012453 │ 20260921012453 │ 2026-09-21 │\n│ 20261007224520 │ │ 2026-10-07 │",
  );
  assert.deepEqual(validateMigrationHistory(history, "pre"), [
    "20261007224520",
  ]);
  assert.throws(() => validateMigrationHistory(history, "post"), /pending/);
});

test("rejects remote-only and historical gaps", () => {
  const remoteOnly = parseMigrationHistory(
    "LOCAL │ REMOTE │ TIME (UTC)\n20260921012453 │ 20260921012453 │ 2026-09-21\n │ 20261001000000 │ 2026-10-01",
  );
  assert.throws(
    () => validateMigrationHistory(remoteOnly, "pre"),
    /remote-only/,
  );

  const historicalGap = parseMigrationHistory(
    "LOCAL │ REMOTE │ TIME (UTC)\n20260901000000 │ │ 2026-09-01\n20260921012453 │ 20260921012453 │ 2026-09-21",
  );
  assert.throws(
    () => validateMigrationHistory(historicalGap, "pre"),
    /historical gap/,
  );
});

test("accepts matching history after migration", () => {
  const history = parseMigrationHistory(
    "LOCAL │ REMOTE │ TIME (UTC)\n20260921012453 │ 20260921012453 │ 2026-09-21\n20261007224520 │ 20261007224520 │ 2026-10-07",
  );
  assert.deepEqual(validateMigrationHistory(history, "post"), []);
});

test("keeps Vercel Git deployment enabled while gating promotion on migration success", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/production-deploy.yml", import.meta.url),
    "utf8",
  );
  const vercelConfig = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.match(workflow, /branches: \[main\]/u);
  assert.match(workflow, /name: Supabase migration gate/u);
  assert.match(workflow, /queue: max/u);
  assert.match(workflow, /production-target "\$SUPABASE_PROJECT_ID"/u);
  assert.ok(
    workflow.indexOf("supabase db push --linked --skip-vault --dry-run") <
      workflow.indexOf("supabase db push --linked --skip-vault --yes"),
  );
  assert.doesNotMatch(workflow, /VERCEL_TOKEN|vercel deploy|vercel promote/u);
  assert.notEqual(vercelConfig.git?.deploymentEnabled?.main, false);
});
