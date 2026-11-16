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
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, resume text, resume_updated_at timestamptz);
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT, DELETE ON storage.objects TO authenticated;
    CREATE TABLE public.resume_uploads(resume_id uuid, user_id uuid, state text, quality_codes text[]);
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array(name, '/') $$;
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    INSERT INTO auth.users VALUES ('${owner}'), ('${other}');
    INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');`);
  for (const file of [
    "20260615190912_resume_storage_source_of_truth.sql",
    "20260726233739_create_candidate_application_profile.sql",
    "20261007224520_candidate_fact_review.sql",
    "20261115202105_resume_fact_review.sql",
  ]) {
    sql(readFileSync(resolve("supabase/migrations", file), "utf8"));
  }
  asUser(
    owner,
    `INSERT INTO candidate_evidence(id,user_id,kind,title,actions,fact_review) VALUES('${id}','${owner}','technical_project','Policy prototype','I built a policy prototype.','{"forged":true}');`,
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
    `UPDATE candidate_evidence SET confirmed_at=now(), fact_review='{"reviewed":true}' WHERE id='${id}';`,
  );
  assert(
    asUser(
      owner,
      `SELECT (confirmed_at IS NOT NULL AND fact_review->>'reviewed' = 'true')::text FROM candidate_evidence WHERE id='${id}';`,
    ),
    "true",
    "owner can confirm an unreviewed project and its facts in the same write",
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

  const resumeId = "44444444-4444-4444-8444-444444444444";
  const replacement = "55555555-5555-4555-8555-555555555555";
  const readResume = (user) =>
    asUser(
      user,
      "SELECT COALESCE(sum(jsonb_array_length(fact_review)),0) FROM user_resumes;",
    );
  const insertResume = (id, primary) =>
    `INSERT INTO user_resumes(id,user_id,label,file_name,file_mime,file_size,storage_path,parsed_text,is_primary,fact_review,review_source_verified)
    VALUES('${id}','${owner}','Test','resume.txt','text/plain',80,'${owner}/${id}/resume.txt',
      'I built a policy prototype for simulated cases.',${primary},'[{"confirmed":true}]',true);`;
  const forged = "66666666-6666-4666-8666-666666666666";
  asUser(owner, insertResume(forged, true));
  asUser(
    owner,
    "UPDATE user_resumes SET fact_review='[{}]',review_source_verified=true WHERE is_primary;",
  );
  assert(
    asUser(
      owner,
      "SELECT review_source_verified::text FROM user_resumes WHERE is_primary;",
    ),
    "false",
    "owner cannot self-certify a parsed source",
  );
  assert(readResume(owner), "0", "unverified source never retains approvals");
  asUser(owner, "DELETE FROM user_resumes WHERE is_primary;");
  sql(insertResume(resumeId, true));
  sql(insertResume(replacement, false));
  assert(readResume(owner), "0", "uploads never preapprove résumé facts");
  const validSource = (user) =>
    asUser(
      user,
      "SELECT count(*) FROM user_resume_review_sources WHERE is_primary AND review_source_verified;",
    );
  assert(validSource(owner), "0", "missing Storage object is never eligible");
  const path = (id) => owner + "/" + id + "/resume.txt";
  const upload = (id) =>
    sql(
      "INSERT INTO storage.objects VALUES ('user-resumes','" + path(id) + "');",
    );
  upload(resumeId);
  upload(replacement);
  assert(validSource(owner), "1", "protected final object is eligible");
  assert(
    validSource(other),
    "0",
    "the view cannot expose another owner's evidence",
  );
  asUser(
    owner,
    "DELETE FROM storage.objects WHERE name='" + path(resumeId) + "';",
  );
  assert(
    validSource(owner),
    "0",
    "owner file removal immediately invalidates an orphan row",
  );
  upload(resumeId);

  const approve = () =>
    asUser(
      owner,
      `UPDATE user_resumes SET fact_review='[{"confirmed":true}]' WHERE id='${resumeId}';`,
    );
  const setPrimary = (user, id) =>
    asUser(user, `SELECT id FROM set_primary_user_resume('${id}');`);
  const activeApproval = () =>
    asUser(
      owner,
      "SELECT jsonb_array_length(fact_review) FROM user_resumes WHERE is_primary;",
    );
  approve();
  assert(readResume(owner), "1", "explicit owner update stores approval");
  assert(readResume(other), "0", "other user cannot read approval");
  assert(
    asUser(
      other,
      "WITH changed AS (UPDATE user_resumes SET fact_review='[{}]' RETURNING id) SELECT count(*) FROM changed;",
    ),
    "0",
    "other user cannot update approval",
  );
  const resumeRevision = asUser(
    owner,
    "SELECT updated_at FROM user_resumes WHERE is_primary;",
  );
  const errors = [];
  for (const user of [owner, other]) {
    if (user === owner)
      sql(
        `ALTER TABLE user_resumes ADD CONSTRAINT test_force_promotion_failure CHECK (id <> '${replacement}' OR NOT is_primary);`,
      );
    try {
      setPrimary(user, replacement);
    } catch {
      errors.push(user);
    }
    if (user === owner)
      sql(
        "ALTER TABLE user_resumes DROP CONSTRAINT test_force_promotion_failure;",
      );
  }
  assert(
    errors.join(","),
    [owner, other].join(","),
    "promotion failure and foreign row both denied",
  );
  assert(
    activeApproval(),
    "1",
    "failed promotion preserves previous primary and approval",
  );
  assert(
    setPrimary(owner, resumeId),
    resumeId,
    "setting the existing primary is a no-op",
  );
  assert(
    asUser(owner, "SELECT updated_at FROM user_resumes WHERE is_primary;"),
    resumeRevision,
    "same primary keeps review revision",
  );
  asUser(owner, "UPDATE user_resumes SET label='Renamed' WHERE is_primary;");
  assert(activeApproval(), "1", "renaming preserves approval");
  assert(
    setPrimary(owner, replacement),
    replacement,
    "owner can replace primary",
  );
  assert(
    readResume(owner),
    "0",
    "replacing primary résumé clears prior approvals",
  );
  setPrimary(owner, resumeId);
  assert(
    activeApproval(),
    "0",
    "restoring prior primary does not restore approvals",
  );
  approve();
  asUser(owner, "UPDATE user_resumes SET fact_review='[]' WHERE is_primary;");
  assert(readResume(owner), "0", "owner can revoke all approvals");
  approve();
  asUser(
    owner,
    "UPDATE user_resumes SET parsed_text='I tested a different service in staging.' WHERE is_primary;",
  );
  assert(readResume(owner), "0", "editing parsed source clears review");
  assert(
    asUser(
      owner,
      "SELECT review_source_verified::text FROM user_resumes WHERE is_primary;",
    ),
    "false",
    "editing parsed source revokes provenance",
  );
  assert(
    asUser(
      owner,
      `WITH changed AS (UPDATE user_resumes SET fact_review='[{}]' WHERE is_primary AND updated_at='${resumeRevision}' RETURNING id) SELECT count(*) FROM changed;`,
    ),
    "0",
    "late save cannot write to a changed source",
  );
  asUser(owner, "DELETE FROM user_resumes WHERE is_primary;");
  setPrimary(owner, replacement);
  asUser(owner, "UPDATE user_resumes SET fact_review='[{}]' WHERE is_primary;");
  assert(activeApproval(), "1", "replacement can be individually confirmed");
  asUser(owner, "DELETE FROM user_resumes WHERE is_primary;");
  assert(readResume(owner), "0", "deleting résumé removes its approval");
  const clipped = "77777777-7777-4777-8777-777777777777";
  sql(insertResume(clipped, true));
  upload(clipped);
  sql(
    "INSERT INTO resume_uploads VALUES ('" +
      clipped +
      "','" +
      owner +
      "','validating',ARRAY['TEXT_TRUNCATED']);",
  );
  sql(
    "UPDATE resume_uploads SET state='ready' WHERE resume_id='" +
      clipped +
      "';",
  );
  assert(
    validSource(owner),
    "0",
    "direct upload truncation revokes source eligibility atomically",
  );
  console.log(
    "Fact review database checks passed: owner RLS, cross-user denial, source invalidation, stale revision, résumé replacement, revocation, and deletion.",
  );
} finally {
  if (started)
    execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "stop"], {
      stdio: "pipe",
    });
  rmSync(root, { recursive: true, force: true });
}
