/** Disposable socket-only PostgreSQL. Never reads DATABASE_URL or .env files. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const bin = process.env.FACT_TEST_PG_BIN;
if (!bin)
  throw new Error("Set FACT_TEST_PG_BIN to a local PostgreSQL bin directory");
const root = mkdtempSync(join(tmpdir(), "ale46-db-"));
const data = join(root, "data");
const args = [
  "-h",
  root,
  "-p",
  "55456",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-At",
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
const asUser = (user, query) =>
  sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; ${query}`)
    .split("\n")
    .at(-1);
const assert = (actual, expected, label) => {
  if (actual !== expected)
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
};
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
      `-h '' -k ${root} -p 55456`,
      "start",
    ],
    { stdio: "pipe" },
  );
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');`);
  for (const file of [
    "20260726233739_create_candidate_application_profile.sql",
    "20261007224520_candidate_fact_review.sql",
  ]) {
    sql(readFileSync(resolve("supabase/migrations", file), "utf8"));
  }
  asUser(
    owner,
    `INSERT INTO candidate_evidence(id,user_id,kind,title,actions,confirmed_at,fact_review) VALUES('${id}','${owner}','technical_project','Policy prototype','I built a policy prototype.',now(),'{"forged":true}');`,
  );
  assert(
    asUser(
      owner,
      `SELECT fact_review::text FROM candidate_evidence WHERE id='${id}';`,
    ),
    "{}",
    "insert cannot preconfirm facts",
  );
  asUser(
    owner,
    `UPDATE candidate_evidence SET fact_review='{"reviewed":true}' WHERE id='${id}';`,
  );
  assert(
    asUser(
      owner,
      `SELECT fact_review->>'reviewed' FROM candidate_evidence WHERE id='${id}';`,
    ),
    "true",
    "owner review persists",
  );
  assert(
    asUser(other, `SELECT count(*) FROM candidate_evidence WHERE id='${id}';`),
    "0",
    "cross-user select denied",
  );
  assert(
    asUser(
      other,
      `WITH changed AS (UPDATE candidate_evidence SET fact_review='{}' WHERE id='${id}' RETURNING id) SELECT count(*) FROM changed;`,
    ),
    "0",
    "cross-user update denied",
  );
  let denied = false;
  try {
    sql("SET ROLE anon; SELECT fact_review FROM candidate_evidence;");
  } catch {
    denied = true;
  }
  assert(String(denied), "true", "anonymous access denied");
  denied = false;
  try {
    asUser(
      owner,
      `UPDATE candidate_evidence SET user_id='${other}' WHERE id='${id}';`,
    );
  } catch {
    denied = true;
  }
  assert(String(denied), "true", "owner reassignment denied");
  const before = asUser(
    owner,
    `SELECT updated_at FROM candidate_evidence WHERE id='${id}';`,
  );
  asUser(
    owner,
    `UPDATE candidate_evidence SET context='Prototype only; no production use.' WHERE id='${id}';`,
  );
  assert(
    asUser(
      owner,
      `SELECT fact_review::text FROM candidate_evidence WHERE id='${id}';`,
    ),
    "{}",
    "source edit invalidates review",
  );
  assert(
    asUser(
      owner,
      `WITH changed AS (UPDATE candidate_evidence SET fact_review='{"stale":true}' WHERE id='${id}' AND updated_at='${before}' RETURNING id) SELECT count(*) FROM changed;`,
    ),
    "0",
    "late review cannot overwrite edited source",
  );
  for (const edit of [
    "title='Renamed prototype'",
    "actions='I tested a policy prototype.'",
    "outcome='Prototype delivered.'",
    "metrics=ARRAY['Simulation only']",
    "skills=ARRAY['TypeScript']",
    "links=ARRAY['https://example.test/project']",
    "kind='achievement'",
    "confirmed_at=NULL",
  ]) {
    asUser(
      owner,
      `UPDATE candidate_evidence SET fact_review='{"reviewed":true}' WHERE id='${id}'; UPDATE candidate_evidence SET ${edit} WHERE id='${id}';`,
    );
    assert(
      asUser(
        owner,
        `SELECT fact_review::text FROM candidate_evidence WHERE id='${id}';`,
      ),
      "{}",
      `invalidation: ${edit}`,
    );
  }
  denied = false;
  try {
    asUser(
      owner,
      `UPDATE candidate_evidence SET confirmed_at=now(); UPDATE candidate_evidence SET fact_review=jsonb_build_object('payload', repeat('x',131073)) WHERE id='${id}';`,
    );
  } catch {
    denied = true;
  }
  assert(String(denied), "true", "oversized review rejected");
  console.log(
    "Fact review database checks passed: owner RLS, anonymous/cross-user denial, insert/source/revocation invalidation, stale revision and payload bound.",
  );
} finally {
  if (started)
    execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "stop"], {
      stdio: "pipe",
    });
  rmSync(root, { recursive: true, force: true });
}
