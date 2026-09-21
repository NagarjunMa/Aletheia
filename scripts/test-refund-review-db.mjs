/** Disposable socket-only PostgreSQL harness. Never reads DATABASE_URL or .env. */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const bin = process.env.REFUND_TEST_PG_BIN;
if (!bin)
  throw new Error("Set REFUND_TEST_PG_BIN to a local PostgreSQL bin directory");
const root = mkdtempSync(join(tmpdir(), "ale53-db-"));
const pg = (name) => join(bin, name);
const args = [
  "-h",
  root,
  "-p",
  "55454",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-At",
];
const sql = (input) =>
  execFileSync(pg("psql"), args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
let started = false;
try {
  execFileSync(
    pg("initdb"),
    ["-D", join(root, "data"), "-A", "trust", "--no-locale"],
    { stdio: "pipe" },
  );
  execFileSync(
    pg("pg_ctl"),
    [
      "-D",
      join(root, "data"),
      "-l",
      join(root, "server.log"),
      "-o",
      `-h '' -k ${root} -p 55454`,
      "start",
    ],
    { stdio: "pipe" },
  );
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
 GRANT ALL ON public.profiles TO service_role;`);
  for (const file of [
    "20260618164022_credit_based_billing.sql",
    "20260815180105_add_yc_application_billing_category.sql",
    "20260921012453_refund_review_queue.sql",
  ])
    sql(readFileSync(resolve("supabase/migrations", file), "utf8"));
  sql(
    readFileSync(resolve("supabase/tests/refund-review.sql"), "utf8").replace(
      "BEGIN;",
      "BEGIN; SET LOCAL ROLE service_role;",
    ),
  );
  const user = "11111111-1111-4111-8111-111111111111";
  const actor = "22222222-2222-4222-8222-222222222222";
  const result =
    sql(`INSERT INTO profiles VALUES('${user}'); SELECT grant_trial_credits_once('${user}',40);
 SELECT reservation_id FROM reserve_generation_credits('${user}','yc_application',4);`)
      .trim()
      .split("\n")
      .at(-1);
  const caseId = sql(
    `SELECT capture_generation_failure(jsonb_build_object('attemptId',gen_random_uuid(),'userId','${user}','category','yc_application','debitId','${result}','code','MODEL_TIMEOUT'));`,
  ).trim();
  sql(
    `SELECT review_refund_case('${caseId}','${actor}','approve','Confirmed failure',gen_random_uuid());`,
  );
  const concurrent = (input) =>
    new Promise((resolve, reject) => {
      const child = spawn(pg("psql"), args, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let error = "";
      child.stderr.on("data", (v) => (error += v));
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(error)),
      );
      child.stdin.end(input);
    });
  await Promise.all([
    concurrent(
      `BEGIN; SET LOCAL ROLE service_role; SELECT refund_generation_credits('${user}',4,'${result}','{}'); SELECT pg_sleep(0.2); COMMIT;`,
    ),
    concurrent(
      `SET ROLE service_role; SELECT execute_reviewed_refund('${caseId}');`,
    ),
    concurrent(
      `SET ROLE service_role; SELECT execute_reviewed_refund('${caseId}');`,
    ),
  ]);
  if (
    sql(
      `SELECT balance FROM user_credit_accounts WHERE user_id='${user}';`,
    ).trim() !== "40"
  )
    throw new Error("Concurrent double credit");
  if (
    sql(
      `SELECT count(*) FROM credit_ledger WHERE related_ledger_id='${result}' AND reason='generation_refund';`,
    ).trim() !== "1"
  )
    throw new Error("Duplicate refund ledger");
  const anchor = sql(
    "SELECT date_trunc('day',now())-interval '14 days';",
  ).trim();
  sql(
    `UPDATE credit_ledger SET created_at='${anchor}'::timestamptz+interval '1 day' WHERE reason='generation_refund';`,
  );
  const debit2 = sql(
    `SELECT reservation_id FROM reserve_generation_credits('${user}','yc_application',4);`,
  ).trim();
  let lateDone;
  let lateChild;
  await new Promise((resolve, reject) => {
    const child = spawn(pg("psql"), args, { stdio: ["pipe", "pipe", "pipe"] });
    lateDone = new Promise((res, rej) => {
      child.on("close", (c) =>
        c === 0 ? res() : rej(new Error("late transaction failed")),
      );
    });
    child.stderr.on("data", (v) => process.stderr.write(v));
    child.stdout.on("data", (v) => {
      if (v.toString().includes("READY_LATE")) resolve();
    });
    child.on("error", reject);
    lateChild = child;
    child.stdin.write(
      `BEGIN; SELECT refund_generation_credits('${user}',4,'${debit2}','{}'); UPDATE credit_ledger SET created_at='${anchor}'::timestamptz+interval '2 days' WHERE related_ledger_id='${debit2}'; SELECT 'READY_LATE';\n`,
    );
  });
  const before = sql(`SELECT prepare_next_refund_week('${anchor}');`).trim();
  lateChild.stdin.end("COMMIT;");
  await lateDone;
  const after = sql(
    `SELECT prepare_next_refund_week('${anchor}'); SELECT prepare_next_refund_week('${anchor}');`,
  ).trim();
  const missed = sql(
    `SELECT count(*) FROM credit_ledger r WHERE r.reason='generation_refund' AND NOT EXISTS(SELECT 1 FROM refund_receipt_items i WHERE i.refund_id=r.id);`,
  ).trim();
  const diagnostic = sql(
    `SELECT prepare_refund_receipts('${anchor}','${anchor}'::timestamptz+interval '7 days');`,
  ).trim();
  const outcomes = after.split("\n").map(JSON.parse);
  if (outcomes.some((v) => v.lateRefunds !== 1))
    throw new Error("Late refund silently lost after cursor advance");
  if (missed !== "1" || JSON.parse(diagnostic).lateRefunds !== 1)
    throw new Error("Late-refund fixture invalid");
  if (sql("SELECT credits FROM refund_receipts;").trim() !== "4")
    throw new Error("Frozen receipt changed");
  console.log(
    "Late-commit regression passed: subsequent and caught-up runs expose reconciliation without modifying frozen receipts.",
  );

  console.log(
    "Refund database checks passed: role denial, capture deduplication, ownership, review, idempotency and concurrent automatic/manual restoration.",
  );
} finally {
  if (started)
    execFileSync(
      pg("pg_ctl"),
      ["-D", join(root, "data"), "-m", "fast", "stop"],
      { stdio: "pipe" },
    );
  rmSync(root, { recursive: true, force: true });
}
