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
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|400|40|400|t||||||",
  );
  const feedbackOnly = query.replace(
    "false AS by_feedback",
    "true AS by_feedback",
  );
  const allFeedback = sql(feedbackOnly).split("|");
  assert.equal(allFeedback.length, 14);
  assert.deepEqual(allFeedback.slice(4, 8), ["400", "40", "400", "t"]);
  assert.equal(
    allFeedback[11],
    "unreported",
    "old receipts must not invent an email mode",
  );
  assert.equal(allFeedback[12], "{action}");
  assert.ok(
    Object.values(JSON.parse(allFeedback[13])).every((count) => count === 0),
    "approvals must never become rejection counts or expose comments",
  );
  sql(
    `UPDATE user_preferences SET share_analytics=false WHERE user_id<>md5('1')::uuid;`,
  );
  assert.equal(
    sql(query),
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|10|1|10|f||||||",
  );
  const byGrounding = query.replace(
    "SELECT false AS by_grounding",
    "SELECT true AS by_grounding",
  );
  assert.equal(
    sql(byGrounding),
    "",
    "legacy receipts cannot enter grounding cohorts",
  );
  const verified = {
    groundingLevel: "verified_evidence",
    fallbackReason: "none",
    selectedSourceCount: 1,
    selectedEvidenceCount: 1,
    selectedSourceKinds: ["evidence"],
    injectionSafeMode: false,
    provenanceValidated: true,
  };
  const targetOnly = {
    ...verified,
    groundingLevel: "target_only",
    fallbackReason: "candidate_context_not_used",
    selectedSourceCount: 0,
    selectedEvidenceCount: 0,
    selectedSourceKinds: [],
  };
  const setGrounding = (summary, where) =>
    sql(
      `UPDATE user_feedback SET metadata=jsonb_set(metadata,'{grounding}','${JSON.stringify(summary)}'::jsonb) WHERE ${where};`,
    );
  setGrounding(verified, "user_id=md5('1')::uuid");
  setGrounding(targetOnly, "id=md5('1/11')::uuid");
  setGrounding(verified, "id=md5('2/11')::uuid"); // Consent withdrawn.
  assert.deepEqual(sql(byGrounding).split("\n").sort(), [
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|1|1|1|f|target_only|candidate_context_not_used|{}|||",
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|9|1|9|f|verified_evidence|none|{evidence}|||",
  ]);
  setGrounding(
    { ...verified, provenanceValidated: undefined },
    "id=md5('1/1')::uuid",
  );
  for (const invalid of [
    { ...verified, sourceId: "PRIVATE_SOURCE_CANARY" },
    { ...verified, selectedSourceKinds: ["PRIVATE_KIND_CANARY"] },
    { ...verified, selectedSourceKinds: ["evidence", "evidence"] },
    { ...verified, selectedEvidenceCount: 2 },
    { ...verified, groundingLevel: "profile_grounded" },
    { ...verified, fallbackReason: "no_resume_context" },
    { ...verified, selectedSourceCount: "1" },
    "PRIVATE_SUMMARY_CANARY",
  ]) {
    setGrounding(invalid, "id=md5('1/10')::uuid");
    assert.deepEqual(sql(byGrounding).split("\n").sort(), [
      "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|1|1|1|f|target_only|candidate_context_not_used|{}|||",
      "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|8|1|8|f|verified_evidence|none|{evidence}|||",
    ]);
  }
  const mixedKinds = {
    ...verified,
    selectedSourceCount: 2,
    selectedSourceKinds: ["profile", "evidence"],
  };
  setGrounding(mixedKinds, "id=md5('1/9')::uuid");
  setGrounding(
    { ...mixedKinds, selectedSourceKinds: ["evidence", "profile"] },
    "id=md5('1/8')::uuid",
  );
  setGrounding(
    { ...targetOnly, fallbackReason: "no_resume_context" },
    "id=md5('1/7')::uuid",
  );
  assert.deepEqual(sql(byGrounding).split("\n").sort(), [
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|1|1|1|f|target_only|candidate_context_not_used|{}|||",
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|1|1|1|f|target_only|no_resume_context|{}|||",
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|2|1|2|f|verified_evidence|none|{evidence,profile}|||",
    "cold_email|6.0.0|claude-sonnet-4-6|evidence_led|5|1|5|f|verified_evidence|none|{evidence}|||",
  ]);
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
  // ALE-30 reuses the same canonical cohort eligibility and ten-outcome cap.
  sql(`UPDATE user_preferences SET share_analytics=(user_id=md5('1')::uuid);
    UPDATE user_feedback SET feedback_type='approved',
      metadata=jsonb_set(jsonb_set(jsonb_set(metadata,'{quality}','${validQuality}'::jsonb),
        '{emailMode}','"initial_outreach"'::jsonb),'{grounding}','${JSON.stringify(verified)}'::jsonb)
      WHERE user_id=md5('1')::uuid;
    UPDATE user_feedback SET feedback_type='rejected',
      metadata=metadata||'{"emailMode":"follow_up","quality_reason":"weak_evidence"}'::jsonb
      WHERE id=md5('1/11')::uuid;
    UPDATE user_feedback SET feedback_type='rejected',
      metadata=metadata||'{"emailMode":"follow_up","quality_reason":"unsupported_feeling"}'::jsonb
      WHERE id=md5('1/10')::uuid;
    UPDATE user_feedback SET feedback_type='rejected',
      metadata=metadata||'{"quality_reason":"PRIVATE_REASON_CANARY"}'::jsonb
      WHERE id=md5('1/9')::uuid;
    UPDATE user_feedback SET metadata=metadata||'{"emailMode":"PRIVATE_MODE_CANARY"}'::jsonb
      WHERE id=md5('1/8')::uuid;
    UPDATE user_feedback SET metadata=jsonb_set(jsonb_set(metadata,'{quality,selectedSourceKinds}',
      '["technology","action"]'::jsonb),'{quality,selectedSourceCount}','2'::jsonb) WHERE id=md5('1/11')::uuid;
    UPDATE user_feedback SET metadata=jsonb_set(jsonb_set(metadata,'{quality,selectedSourceKinds}',
      '["action","technology"]'::jsonb),'{quality,selectedSourceCount}','2'::jsonb) WHERE id=md5('1/10')::uuid;`);
  const feedbackQuery = byGrounding.replace(
    "false AS by_feedback",
    "true AS by_feedback",
  );
  const feedbackRows = sql(feedbackQuery)
    .split("\n")
    .map((row) => row.split("|"));
  assert.equal(
    feedbackRows.length,
    3,
    "mode breakdown must distinguish follow-up, initial and unreported",
  );
  assert.equal(
    feedbackRows.reduce((sum, row) => sum + Number(row[4]), 0),
    10,
    "new dimensions must not multiply the parent contribution cap",
  );
  const followUp = feedbackRows.find((row) => row[11] === "follow_up");
  assert.ok(followUp);
  assert.deepEqual(followUp.slice(4, 8), ["2", "1", "0", "f"]);
  assert.equal(followUp[12], "{action,technology}");
  const reasons = JSON.parse(followUp[13]);
  assert.equal(reasons.weak_evidence, 1);
  assert.equal(reasons.unsupported_feeling, 1);
  assert.equal(
    Object.values(reasons).reduce((sum, count) => sum + count, 0),
    2,
  );
  const initial = feedbackRows.find((row) => row[11] === "initial_outreach");
  assert.ok(initial);
  assert.deepEqual(initial.slice(4, 8), ["7", "1", "6", "f"]);
  assert.equal(JSON.parse(initial[13]).unreported, 1);
  assert.equal(feedbackRows.find((row) => row[11] === "unreported")?.[4], "1");
  assert.doesNotMatch(
    JSON.stringify(feedbackRows),
    /PRIVATE|[0-9a-f]{8}-[0-9a-f-]{27}/u,
  );
  for (const [index, summary] of [
    [
      7,
      {
        ...verified,
        groundingLevel: "profile_grounded",
        fallbackReason: "no_confirmed_evidence",
        selectedEvidenceCount: 0,
        selectedSourceKinds: ["profile"],
      },
    ],
    [
      6,
      {
        ...verified,
        groundingLevel: "resume_fallback",
        fallbackReason: "no_profile_context",
        selectedEvidenceCount: 0,
        selectedSourceKinds: ["resume"],
      },
    ],
    [5, targetOnly],
  ])
    setGrounding(summary, `id=md5('1/${index}')::uuid`);
  const levels = sql(feedbackQuery)
    .split("\n")
    .map((row) => row.split("|"));
  assert.deepEqual([...new Set(levels.map((row) => row[8]))].sort(), [
    "profile_grounded",
    "resume_fallback",
    "target_only",
    "verified_evidence",
  ]);
  assert.equal(
    levels.reduce((sum, row) => sum + Number(row[4]), 0),
    10,
  );
  sql(
    `UPDATE user_feedback SET metadata=metadata||'{"emailMode":"follow_up"}'::jsonb WHERE id=md5('1/4')::uuid;`,
  );
  setGrounding(
    { ...verified, sourceId: "PRIVATE_SOURCE_CANARY" },
    "id=md5('1/4')::uuid",
  );
  const safeRows = sql(feedbackQuery);
  assert.doesNotMatch(safeRows, /PRIVATE/u);
  assert.equal(
    safeRows
      .split("\n")
      .reduce((sum, row) => sum + Number(row.split("|")[4]), 0),
    10,
    "the next eligible receipt may refill the unchanged contribution cap",
  );
  assert.equal(
    safeRows
      .split("\n")
      .map((row) => row.split("|"))
      .find((row) => row[11] === "follow_up")?.[4],
    "2",
    "malformed grounding must not add a third follow-up outcome",
  );
  for (const mode of [
    "initial_outreach",
    "founder_ceo_outreach",
    "follow_up",
    "clarification",
    "role_fit_summary",
    "referral_request",
  ]) {
    sql(
      `UPDATE user_feedback SET metadata=jsonb_set(metadata,'{emailMode}','"${mode}"'::jsonb) WHERE user_id=md5('1')::uuid;`,
    );
    const rows = sql(feedbackQuery)
      .split("\n")
      .map((row) => row.split("|"));
    assert.ok(
      rows.every((row) => row[11] === mode),
      `${mode} must not collapse to unreported`,
    );
    assert.equal(
      rows.reduce((sum, row) => sum + Number(row[4]), 0),
      10,
    );
  }
  sql("UPDATE user_preferences SET share_analytics=false;");
  assert.equal(
    sql(feedbackQuery),
    "",
    "withdrawal must remove prior breakdown data",
  );
  console.log(
    "Quality SQL passed: canonical PK concurrency, owner/anonymous denial, reassignment denial, consent withdrawal, contribution cap, cohort floor, grounding/mode/claim-kind/reason breakdown, stable approval denominators and private-column exclusion.",
  );
} finally {
  if (started)
    execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "stop"], {
      stdio: "pipe",
    });
  rmSync(root, { recursive: true, force: true });
}
