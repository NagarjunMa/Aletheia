/** Socket-only disposable PostgreSQL; never reads .env or a remote database URL. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const bin = process.env.QUALITY_TEST_PG_BIN;
if (!bin)
  throw new Error(
    "Set QUALITY_TEST_PG_BIN to the local PostgreSQL bin directory",
  );
const root = mkdtempSync(join(tmpdir(), "ale51-db-"));
const data = join(root, "data");
const args = [
  "-h",
  root,
  "-p",
  "55459",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-Atq",
  "-F",
  "|",
];
const sql = (input) =>
  execFileSync(join(bin, "psql"), args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const asUser = (id, query) =>
  `SET ROLE authenticated; SET request.jwt.claim.sub='${id}'; ${query}`;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const receipt = "33333333-3333-4333-8333-333333333333";
const concurrent = (input) =>
  new Promise((done, reject) => {
    const child = spawn(join(bin, "psql"), args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.resume();
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? done(output.trim())
        : reject(new Error("Concurrent SQL failed")),
    );
    child.stdin.end(input);
  });
function table(file, name) {
  const source = readFileSync(resolve("supabase/migrations", file), "utf8");
  const ddl = source.match(
    new RegExp(`CREATE TABLE ${name} \\([\\s\\S]*?\\n\\);`),
  )?.[0];
  assert.ok(ddl, `Canonical table ${name} missing`);
  return ddl;
}
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
      `-h '' -k ${root} -p 55459`,
      "start",
    ],
    { stdio: "pipe" },
  );
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE); CREATE TABLE generated_drafts(id uuid PRIMARY KEY);
 INSERT INTO auth.users VALUES('${owner}'),('${other}'); INSERT INTO profiles SELECT id FROM auth.users;`);
  sql(table("20260218003_create_tier2_tables.sql", "user_feedback"));
  sql(table("20260218002_create_tier1_tables.sql", "user_preferences"));
  const uniquePreference = readFileSync(
    resolve("supabase/migrations/20260510_atomic_style_increment.sql"),
    "utf8",
  ).match(
    /ALTER TABLE user_preferences\s+ADD CONSTRAINT user_preferences_user_id_key UNIQUE \(user_id\);/,
  )?.[0];
  assert.ok(
    uniquePreference,
    "Canonical one-preference-per-user constraint missing",
  );
  sql(uniquePreference);
  const policies = readFileSync(
    resolve("supabase/migrations/20260218004_create_rls_policies.sql"),
    "utf8",
  );
  const feedbackPolicy = policies.match(
    /ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;[\s\S]*?;/g,
  )?.[0];
  assert.ok(feedbackPolicy); // Load the actual owner policy as well as RLS enablement.
  sql(
    policies.match(
      /ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;\s*CREATE POLICY[^;]*;/,
    )?.[0] ??
      (() => {
        throw new Error("Owner policy missing");
      })(),
  );
  sql(
    "GRANT USAGE ON SCHEMA auth TO anon,authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON user_feedback TO anon,authenticated;",
  );
  assert.deepEqual(
    (
      await Promise.all(
        [1, 2].map(() =>
          concurrent(
            asUser(
              owner,
              `WITH inserted AS (INSERT INTO user_feedback(id,user_id,feedback_type) VALUES('${receipt}','${owner}','approved') ON CONFLICT DO NOTHING RETURNING id) SELECT count(*) FROM inserted;`,
            ),
          ),
        ),
      )
    ).sort(),
    ["0", "1"],
  );
  assert.equal(
    sql(
      asUser(
        owner,
        `SELECT count(*) FROM user_feedback WHERE id='${receipt}';`,
      ),
    ),
    "1",
  );
  assert.equal(
    sql(
      asUser(
        other,
        `SELECT count(*) FROM user_feedback WHERE id='${receipt}';`,
      ),
    ),
    "0",
  );
  assert.equal(
    sql(
      asUser(
        other,
        `WITH removed AS(DELETE FROM user_feedback WHERE id='${receipt}' RETURNING id)SELECT count(*) FROM removed;`,
      ),
    ),
    "0",
  );
  assert.equal(sql("SET ROLE anon;SELECT count(*) FROM user_feedback;"), "0");
  assert.throws(() =>
    sql(
      asUser(
        other,
        `INSERT INTO user_feedback(user_id,feedback_type)VALUES('${owner}','approved');`,
      ),
    ),
  );
  assert.throws(() =>
    sql(
      asUser(
        owner,
        `UPDATE user_feedback SET user_id='${other}' WHERE id='${receipt}';`,
      ),
    ),
  );
  sql(`INSERT INTO auth.users SELECT md5(n::text)::uuid FROM generate_series(1,40)n;
 INSERT INTO profiles SELECT id FROM auth.users ON CONFLICT DO NOTHING;
 INSERT INTO user_preferences(user_id,share_analytics) SELECT md5(n::text)::uuid,true FROM generate_series(1,40)n;
 INSERT INTO user_feedback(id,user_id,feedback_type,comment,metadata,created_at)
 SELECT md5(n::text||'/'||i::text)::uuid,md5(n::text)::uuid,'approved','PRIVATE_COMMENT_CANARY',jsonb_build_object('quality_version',1,'generationId',md5(n::text||'/'||i::text)::uuid::text,'category','cold_email','promptVersion','6.0.0','model','claude-sonnet-4-6','quality',jsonb_build_object('version',1,'archetype','evidence_led','groundingPassed',true,'selectedSourceCount',1,'selectedSourceKinds',jsonb_build_array('action'),'finalizationPatternCount',0),'metrics_trust','client_reported_unverified'),now()-((i*2)||' days')::interval
 FROM generate_series(1,40)n CROSS JOIN generate_series(1,11)i;`);
  const query = readFileSync(
    resolve("docs/evals/quality-feedback-cohorts.sql"),
    "utf8",
  );
  assert.equal(
    sql(query),
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|400|40|400|t",
  );
  sql(
    `UPDATE user_preferences SET share_analytics=false WHERE user_id<>md5('1')::uuid;`,
  );
  assert.equal(
    sql(query),
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|10|1|10|f",
  );
  const validQuality = sql(
    "SELECT metadata->'quality' FROM user_feedback WHERE metadata->>'quality_version'='1' LIMIT 1;",
  );
  for (const invalid of [
    { version: 1, archetype: "evidence_led", groundingPassed: true },
    {
      version: 1,
      archetype: "evidence_led",
      groundingPassed: "true",
      selectedSourceCount: 1,
      selectedSourceKinds: ["action"],
      finalizationPatternCount: 0,
    },
    {
      version: 1,
      archetype: "evidence_led",
      groundingPassed: true,
      selectedSourceCount: 65,
      selectedSourceKinds: ["action"],
      finalizationPatternCount: 0,
    },
    {
      version: 1,
      archetype: "evidence_led",
      groundingPassed: true,
      selectedSourceCount: 1,
      selectedSourceKinds: "action",
      finalizationPatternCount: 0,
    },
    {
      version: 1,
      archetype: "evidence_led",
      groundingPassed: true,
      selectedSourceCount: 1,
      selectedSourceKinds: ["PRIVATE_KIND_CANARY"],
      finalizationPatternCount: 0,
    },
    {
      version: 1,
      archetype: "evidence_led",
      groundingPassed: true,
      selectedSourceCount: 1,
      selectedSourceKinds: ["action"],
      finalizationPatternCount: 257,
    },
    {
      version: 1,
      archetype: "evidence_led",
      groundingPassed: true,
      selectedSourceCount: 1,
      selectedSourceKinds: ["action"],
      finalizationPatternCount: 0,
      body: "PRIVATE_BODY_CANARY",
    },
  ]) {
    sql(
      `UPDATE user_preferences SET share_analytics=true; UPDATE user_feedback SET metadata=jsonb_set(metadata,'{quality}','${JSON.stringify(invalid)}'::jsonb) WHERE metadata->>'quality_version'='1';`,
    );
    assert.equal(sql(query), "", "malformed quality must not enter reports");
  }
  sql(
    `UPDATE user_feedback SET metadata=jsonb_set(metadata,'{quality}','${validQuality}'::jsonb) WHERE metadata->>'quality_version'='1';`,
  );
  sql("UPDATE user_preferences SET share_analytics=null;");
  assert.equal(sql(query), "");
  console.log(
    "Quality SQL passed: canonical PK concurrency, owner/anonymous denial, reassignment denial, consent withdrawal, contribution cap, cohort floor and private-column exclusion.",
  );
} finally {
  if (started)
    execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "stop"], {
      stdio: "pipe",
    });
  rmSync(root, { recursive: true, force: true });
}
