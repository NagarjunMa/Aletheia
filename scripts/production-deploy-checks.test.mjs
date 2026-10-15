import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseMigrationHistory,
  validateAppConnection,
  validateHealth,
  validateMigrationHistory,
  validateTarget,
} from "./production-deploy-checks.mjs";

const projectRef = "abc12fghij345mnopqrs";

test("rejects a Vercel project connected to a different Supabase project", () => {
  assert.throws(
    () =>
      validateTarget(
        'NEXT_PUBLIC_SUPABASE_URL="https://otherprojectrefabcd.supabase.co"',
        projectRef,
      ),
    /different Supabase project/,
  );
  assert.doesNotThrow(() =>
    validateTarget(
      `NEXT_PUBLIC_SUPABASE_URL="https://${projectRef}.supabase.co"`,
      projectRef,
    ),
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

test("accepts matching history after migration and validates staged health", () => {
  const history = parseMigrationHistory(
    "LOCAL │ REMOTE │ TIME (UTC)\n20260921012453 │ 20260921012453 │ 2026-09-21\n20261007224520 │ 20261007224520 │ 2026-10-07",
  );
  assert.deepEqual(validateMigrationHistory(history, "post"), []);
  assert.doesNotThrow(() =>
    validateHealth(
      JSON.stringify({
        status: "ok",
        supabaseOrigin: `https://${projectRef}.supabase.co`,
      }),
      projectRef,
    ),
  );
  assert.throws(
    () =>
      validateHealth(
        JSON.stringify({ status: "ok", supabaseOrigin: null }),
        projectRef,
      ),
    /different Supabase project/,
  );
});

test("validates Vercel's production Supabase keys without reading user rows", async () => {
  const calls = [];
  const vercelEnv = [
    `NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_demo"`,
    `SUPABASE_SERVICE_ROLE_KEY="sb_secret_demo"`,
  ].join("\n");
  await validateAppConnection(vercelEnv, projectRef, async (url, options) => {
    calls.push({ url: String(url), key: options.headers.apikey });
    return { ok: true, status: 200 };
  });
  assert.deepEqual(calls, [
    {
      url: `https://${projectRef}.supabase.co/auth/v1/settings`,
      key: "sb_publishable_demo",
    },
    {
      url: `https://${projectRef}.supabase.co/rest/v1/candidate_evidence?select=fact_review&limit=0`,
      key: "sb_secret_demo",
    },
  ]);
  await assert.rejects(
    validateAppConnection(vercelEnv, projectRef, async () => ({
      ok: false,
      status: 401,
    })),
    /anon key failed validation.*401/,
  );
  await assert.rejects(
    validateAppConnection(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_demo"`,
      projectRef,
      async () => ({ ok: true, status: 200 }),
    ),
    /private Supabase key is missing/,
  );
  await assert.rejects(
    validateAppConnection(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_secret_demo"\nSUPABASE_SERVICE_ROLE_KEY="sb_secret_demo"`,
      projectRef,
      async () => ({ ok: true, status: 200 }),
    ),
    /public Supabase key is missing or unsafe/,
  );
});

test("rejects a legacy service-role JWT in the public key setting", async () => {
  const jwt = (role) =>
    `e30.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  await assert.rejects(
    validateAppConnection(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY="${jwt("service_role")}"\nSUPABASE_SERVICE_ROLE_KEY="${jwt("service_role")}"`,
      projectRef,
      async () => ({ ok: true, status: 200 }),
    ),
    /public Supabase key is missing or unsafe/,
  );
  await assert.doesNotReject(
    validateAppConnection(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY="${jwt("anon")}"\nSUPABASE_SERVICE_ROLE_KEY="${jwt("service_role")}"`,
      projectRef,
      async () => ({ ok: true, status: 200 }),
    ),
  );
});
