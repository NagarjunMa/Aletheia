/** Disposable socket-only PostgreSQL. Never loads .env or a hosted connection. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const bin = process.env.DASHBOARD_TEST_PG_BIN;
if (!bin)
  throw new Error(
    "Set DASHBOARD_TEST_PG_BIN to a local PostgreSQL bin directory",
  );
const root = mkdtempSync(join(tmpdir(), "ale75-db-"));
const data = join(root, "data");
const args = [
  "-h",
  root,
  "-p",
  "55461",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-Atq",
];
const sql = (input) =>
  execFileSync(join(bin, "psql"), args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const asUser = (user, input) =>
  sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; ${input}`);
const metrics = (user, days = 30) =>
  JSON.parse(asUser(user, `SELECT public.get_dashboard_metrics(${days});`));
let started = false;
try {
  execFileSync(
    join(bin, "initdb"),
    ["-D", data, "-A", "trust", "--no-locale"],
    { stdio: "pipe" },
  );
  execFileSync(
    join(bin, "pg_ctl"),
    [
      "-D",
      data,
      "-l",
      join(root, "server.log"),
      "-o",
      `-h '' -k ${root} -p 55461`,
      "start",
    ],
    { stdio: "pipe" },
  );
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
    CREATE TABLE public.generated_drafts(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${owner}'),('${other}');
    INSERT INTO profiles SELECT id FROM auth.users;`);
  const feedback = readFileSync(
    resolve("supabase/migrations/20260218003_create_tier2_tables.sql"),
    "utf8",
  ).match(/CREATE TABLE user_feedback \([\s\S]*?\n\);/)?.[0];
  assert.ok(feedback);
  sql(feedback);
  sql(
    readFileSync(
      resolve("supabase/migrations/20260217_create_extension_rate_limits.sql"),
      "utf8",
    ),
  );
  sql(
    readFileSync(
      resolve(
        "supabase/migrations/20261118221108_dashboard_activity_metrics.sql",
      ),
      "utf8",
    ),
  );

  const empty = metrics(owner);
  assert.equal(empty.activity.requests, 0);
  assert.equal(empty.activity.successRate, null);
  assert.equal(empty.reviews.approvalRate, null);
  assert.equal(empty.activity.byCategory.length, 4);
  assert.equal(empty.activity.daily.length, 30);
  assert.equal(empty.quota.resetAt, null);
  // Exercise output parsing against the actual SQL JSON shape.
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      'const {dashboardAggregateSchema}=require("./modules/dashboard/domain/dashboard-metrics.ts"); dashboardAggregateSchema.parse(JSON.parse(require("node:fs").readFileSync(0,"utf8")));',
    ],
    { input: JSON.stringify(empty), stdio: ["pipe", "pipe", "pipe"] },
  );
  assert.throws(() =>
    sql("SET ROLE anon; SELECT public.get_dashboard_metrics();"),
  );
  assert.throws(() => asUser("", "SELECT public.get_dashboard_metrics();"));
  assert.throws(() => metrics(owner, 0));
  assert.throws(() => metrics(owner, 91));
  assert.throws(() =>
    asUser(owner, "SELECT * FROM dashboard_generation_activity;"),
  );
  assert.throws(() =>
    asUser(owner, "SELECT public.cleanup_dashboard_activity();"),
  );
  assert.throws(() =>
    asUser(
      owner,
      `INSERT INTO dashboard_generation_activity VALUES ('${id}','${other}','cold_email',200,1,1,1,now());`,
    ),
  );

  sql(`SET ROLE service_role;
    INSERT INTO dashboard_generation_activity(id,user_id,category,status,requested_answers,successful_outputs,provider_attempts)
    VALUES ('${id}','${owner}','yc_application',200,5,5,2);
    INSERT INTO dashboard_generation_activity(id,user_id,category,status,requested_answers,successful_outputs,provider_attempts)
    VALUES ('${id}','${owner}','yc_application',200,5,5,2) ON CONFLICT(id) DO NOTHING;
    INSERT INTO dashboard_generation_activity(id,user_id,category,status,requested_answers,successful_outputs,provider_attempts)
    VALUES (gen_random_uuid(),'${owner}','cold_email',502,1,0,1),
      (gen_random_uuid(),'${owner}','linkedin_connection',422,1,0,0),
      (gen_random_uuid(),'${owner}','linkedin_inmail',200,1,1,NULL),
      (gen_random_uuid(),'${other}','cold_email',200,1,1,1);`);
  const result = metrics(owner);
  assert.equal(result.activity.requests, 4);
  assert.equal(result.activity.successfulRequests, 2);
  assert.equal(result.activity.failedRequests, 2);
  assert.equal(result.activity.outputs, 6);
  assert.equal(result.activity.successRate, 50);
  assert.equal(result.activity.providerAttempts, null);
  assert.equal(result.activity.unknownProviderRequests, 1);
  assert.equal(
    result.activity.byCategory.find((r) => r.category === "yc_application")
      .outputs,
    5,
  );
  assert.equal(
    result.activity.byCategory.find((r) => r.category === "cold_email").outputs,
    0,
  );
  assert.equal(
    result.activity.daily.reduce((n, r) => n + r.requests, 0),
    4,
  );
  assert.equal(metrics(other).activity.requests, 1);
  assert.equal(result.reviews.approvalRate, null); // Feedback is not needed to count success.
  assert.ok(!JSON.stringify(result).includes(owner));
  assert.ok(!JSON.stringify(result).includes(id));

  sql(`INSERT INTO user_feedback(user_id,feedback_type,metadata) VALUES
    ('${owner}','approved','{"generationId":"one"}'),
    ('${owner}','approved','{"generationId":"one"}'),
    ('${owner}','rejected','{"quality_reason":"too_generic"}'),
    ('${owner}','rejected','{"issue_category":"unsupported_claim"}'),
    ('${owner}','rejected','{"quality_reason":"PRIVATE_SOURCE_CANARY"}'),
    ('${other}','approved','{}');`);
  const reviewed = metrics(owner);
  assert.equal(reviewed.reviews.approved, 1);
  assert.equal(reviewed.reviews.rejected, 3);
  assert.equal(reviewed.reviews.approvalRate, 25);
  assert.deepEqual(
    new Set(reviewed.reviews.rejectionReasons.map((r) => r.reason)),
    new Set(["too_generic", "unsupported_claim", "unspecified"]),
  );
  assert.ok(!JSON.stringify(reviewed).includes("PRIVATE_SOURCE_CANARY"));
  sql(
    `INSERT INTO extension_rate_limits(user_id,request_count,window_start) VALUES ('${owner}',7,now()-interval '1 hour');`,
  );
  assert.equal(metrics(owner).quota.used, 7);
  sql(
    `UPDATE extension_rate_limits SET window_start=now()-interval '24 hours' WHERE user_id='${owner}';`,
  );
  assert.equal(metrics(owner).quota.used, 0);
  assert.equal(metrics(owner).quota.resetAt, null);
  const nonUtc = JSON.parse(
    asUser(
      owner,
      "SET timezone='Pacific/Auckland'; SELECT public.get_dashboard_metrics(90);",
    ),
  );
  assert.equal(nonUtc.activity.daily.length, 90);
  assert.ok(nonUtc.period.from.endsWith("00:00:00+00:00"));

  sql(`INSERT INTO dashboard_generation_activity(id,user_id,category,status,requested_answers,successful_outputs,provider_attempts,created_at)
    SELECT gen_random_uuid(),'${owner}','cold_email',200,1,1,1,now()-interval '91 days' FROM generate_series(1,1001);`);
  assert.equal(
    sql("SET ROLE service_role; SELECT public.cleanup_dashboard_activity();"),
    "1000",
  );
  assert.equal(
    sql("SET ROLE service_role; SELECT public.cleanup_dashboard_activity();"),
    "1",
  );
  assert.equal(
    sql("SET ROLE service_role; SELECT public.cleanup_dashboard_activity();"),
    "0",
  );
  sql(`DELETE FROM auth.users WHERE id='${owner}';`);
  assert.equal(
    sql(
      `SELECT count(*) FROM dashboard_generation_activity WHERE user_id='${owner}';`,
    ),
    "0",
  );
  console.log(
    "ALE-75 migration, SQL contract, idempotency, two-account isolation, quota, privacy, timezones, retention and deletion passed.",
  );
} finally {
  if (started)
    execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"], {
      stdio: "pipe",
    });
  rmSync(root, { recursive: true, force: true });
}
