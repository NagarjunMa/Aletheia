/** ALE-56 disposable socket-only PostgreSQL harness. Never reads .env or DATABASE_URL. */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const bin = process.env.ALE56_TEST_PG_BIN;
if (!bin)
  throw new Error("Set ALE56_TEST_PG_BIN to a local PostgreSQL bin directory");
const root = mkdtempSync(join(tmpdir(), "ale56-db-"));
const pg = (name) => join(bin, name);
const args = [
  "-h",
  root,
  "-p",
  "55457",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-Atq",
  "-F",
  "|",
];
const sql = (input) =>
  execFileSync(pg("psql"), args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const concurrent = (input) =>
  new Promise((resolveCall, rejectCall) => {
    const child = spawn(pg("psql"), args, { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    child.on("error", rejectCall);
    child.on("close", (code) =>
      code === 0 ? resolveCall(output.trim()) : rejectCall(new Error(errors)),
    );
    child.stdin.end(input);
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
      `-h '' -k ${root} -p 55457`,
      "start",
    ],
    { stdio: "pipe" },
  );
  started = true;
  sql(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);",
  );
  for (const file of [
    "20260217_create_extension_rate_limits.sql",
    "20260607212225_harden_security_definer_rpc_permissions.sql",
    "20261026025036_production_audit_admission.sql",
  ])
    sql(readFileSync(resolve("supabase/migrations", file), "utf8"));
  sql(readFileSync(resolve("supabase/tests/generation-admission.sql"), "utf8"));

  const one = "11111111-1111-4111-8111-111111111111";
  const two = "22222222-2222-4222-8222-222222222222";
  sql(`INSERT INTO auth.users(id) VALUES ('${one}'),('${two}');`);
  const dailyResults = await Promise.all([
    concurrent(
      `SELECT allowed FROM public.reserve_generation_daily_slot('${one}',1);`,
    ),
    concurrent(
      `SELECT allowed FROM public.reserve_generation_daily_slot('${one}',1);`,
    ),
  ]);
  if (dailyResults.sort().join(",") !== "f,t")
    throw new Error(`Daily concurrency failed: ${dailyResults}`);

  const first = sql(
    `SELECT reservation_id FROM public.reserve_generation_daily_slot('${two}',30);`,
  );
  const second = sql(
    `SELECT reservation_id FROM public.reserve_generation_daily_slot('${two}',30);`,
  );
  const attemptResults = await Promise.all([
    concurrent(
      `SELECT allowed,attempt_id,denial_code FROM public.start_generation_attempt('${two}','${first}',8,6,60);`,
    ),
    concurrent(
      `SELECT allowed,attempt_id,denial_code FROM public.start_generation_attempt('${two}','${second}',8,6,60);`,
    ),
  ]);
  if (
    attemptResults.filter((result) => result.startsWith("t|")).length !== 1 ||
    attemptResults.filter((result) =>
      result.startsWith("f||GENERATION_IN_PROGRESS"),
    ).length !== 1
  )
    throw new Error(`In-flight concurrency failed: ${attemptResults}`);
  if (
    sql(
      `SELECT short_attempts,work_units FROM public.generation_admission_state WHERE user_id='${two}';`,
    ) !== "1|8"
  )
    throw new Error(
      "Rejected parallel request consumed an attempt or work budget",
    );
  // Additional production-audit migrations run only in this disposable cluster.
  sql(
    readFileSync(
      resolve(
        "supabase/migrations/20261026025206_public_feedback_admission.sql",
      ),
      "utf8",
    ),
  );
  sql(readFileSync(resolve("supabase/tests/public-feedback.sql"), "utf8"));
  const feedbackResults = await Promise.all(
    Array.from({ length: 12 }, () =>
      concurrent(
        `SELECT allowed FROM public.reserve_public_feedback_slot(repeat('b',64));`,
      ),
    ),
  );
  if (
    feedbackResults.filter((result) => result === "t").length !== 5 ||
    feedbackResults.filter((result) => result === "f").length !== 7
  )
    throw new Error("Parallel feedback requests bypassed the shared cap");
  sql(`CREATE TABLE public.profiles(id uuid PRIMARY KEY, resume text, resume_updated_at timestamptz, full_name text);
    CREATE TABLE public.user_resumes(id uuid PRIMARY KEY, user_id uuid, parsed_text text);
    INSERT INTO public.profiles VALUES ('${one}', 'retired private duplicate', now(), 'Preserved Name');
    INSERT INTO public.user_resumes VALUES ('${one}', '${one}', 'preserved visible resume');`);
  sql(
    readFileSync(
      resolve(
        "supabase/migrations/20261026025105_retire_legacy_resume_context.sql",
      ),
      "utf8",
    ),
  );
  sql(`DO $$ BEGIN
    ASSERT (SELECT resume IS NULL AND resume_updated_at IS NULL AND full_name='Preserved Name' FROM public.profiles WHERE id='${one}');
    ASSERT (SELECT parsed_text='preserved visible resume' FROM public.user_resumes WHERE id='${one}');
    BEGIN
      UPDATE public.profiles SET resume='obsolete write' WHERE id='${one}';
      RAISE EXCEPTION 'Legacy resume write was allowed';
    EXCEPTION WHEN check_violation THEN NULL; END;
  END $$;`);
  console.log(
    "Production audit DB checks passed: role isolation, unique release, rollover, limits, daily/in-flight concurrency, feedback burst/concurrency, and legacy-resume retirement.",
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
