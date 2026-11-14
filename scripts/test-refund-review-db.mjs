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
      `-h '' -k ${root} -p 55454 -c timezone=UTC`,
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
    "20261114050948_refund_receipt_payload_retention.sql",
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
      let output = "",
        error = "";
      child.stdout.on("data", (v) => (output += v));
      child.stderr.on("data", (v) => (error += v));
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0 ? resolve(output) : reject(new Error(error)),
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
  sql(`SELECT prepare_next_refund_week('${anchor}');`);
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

  const competingClaims = await Promise.all(
    Array.from({ length: 6 }, () =>
      concurrent("SET ROLE service_role; SELECT claim_refund_receipt();"),
    ),
  );
  const claimed = competingClaims.flatMap((output) =>
    output
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map(JSON.parse),
  );
  if (claimed.length !== 1)
    throw new Error(
      "Overlapping receipt workers did not acquire exactly one lease",
    );
  const activeReceiptId = claimed[0].receipt.id;
  const leaseState = sql(
    `SELECT attempts, lease_id FROM refund_receipt_delivery WHERE receipt_id='${activeReceiptId}';`,
  ).trim();
  if (leaseState !== `1|${claimed[0].leaseId}`)
    throw new Error("A concurrent receipt claim replaced the original lease");
  console.log("Concurrent receipt workers acquired the available lease once.");

  // An aged prefix must not hide a later eligible receipt.
  const nextClaim = JSON.parse(
    sql(`BEGIN;
      UPDATE refund_receipt_delivery
      SET first_attempt_at=now()-interval '23 hours'+interval '50 milliseconds',
          next_attempt_at=now()-interval '1 minute', lease_id=NULL, lease_until=NULL,
          payload='{"to":["synthetic@example.test"]}'::jsonb
      WHERE receipt_id='${activeReceiptId}';
      UPDATE refund_receipts SET delivery_status='uncertain' WHERE id='${activeReceiptId}';
      INSERT INTO refund_receipts(id,user_id,period_start,period_end,credits,generation_count,created_at)
      VALUES ('33333333-3333-4333-8333-333333333333','${user}',now()-interval '42 days',now()-interval '35 days',4,1,now()+interval '1 second');
      SELECT pg_sleep(0.1);
      SELECT claim_refund_receipt();
      COMMIT;`)
      .split("\n")
      .find((line) => line.startsWith("{")) ?? "null",
  );
  if (nextClaim?.receipt.id !== "33333333-3333-4333-8333-333333333333")
    throw new Error(
      "A receipt at its retry cutoff hid the next queued receipt",
    );

  // A freeze that arrives after lease expiry must leave the redacted row empty.
  sql(`BEGIN;
    UPDATE refund_receipt_delivery
    SET first_attempt_at=now()-interval '23 hours', lease_until=now()+interval '50 milliseconds',
        lease_id='44444444-4444-4444-8444-444444444444', payload=NULL
    WHERE receipt_id='${activeReceiptId}';
    SELECT pg_sleep(0.1);
    DO $$
    BEGIN
      PERFORM freeze_refund_receipt_payload(
        '${activeReceiptId}', '44444444-4444-4444-8444-444444444444',
        '{"from":"test@example.test","to":["synthetic@example.test"],"subject":"Receipt","text":"Synthetic credits"}'::jsonb
      );
      RAISE EXCEPTION 'Expired lease froze a replacement payload';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Receipt lease expired' THEN RAISE; END IF;
    END $$;
    ROLLBACK;`);

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
