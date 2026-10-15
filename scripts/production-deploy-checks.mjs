import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

function projectOrigin(projectRef) {
  if (!/^[a-z0-9]{20}$/u.test(projectRef)) {
    throw new Error(
      "Production Supabase project reference is missing or invalid",
    );
  }
  return `https://${projectRef}.supabase.co`;
}

export function validateTarget(vercelEnv, projectRef) {
  const expected = projectOrigin(projectRef);
  const configured = parseEnv(vercelEnv).NEXT_PUBLIC_SUPABASE_URL;
  if (!configured || new URL(configured).origin !== expected) {
    throw new Error("Vercel production uses a different Supabase project");
  }
}

/** Parse the LOCAL / REMOTE table produced by the pinned Supabase CLI. */
export function parseMigrationHistory(output) {
  const bordered = /^\s*[│|]\s*LOCAL\s*[│|]/imu.test(output);
  const rows = output
    .split(/\r?\n/u)
    .filter((line) => line.includes("│") || line.includes("|"))
    .map((line) => {
      const cells = line.split(/[│|]/u).map((cell) => cell.trim());
      if (bordered) cells.shift();
      return cells;
    })
    .filter((cells) => cells.length >= 3)
    .map(([local, remote]) => ({ local, remote }))
    .filter(
      ({ local, remote }) =>
        /^\d{8,14}$/u.test(local) || /^\d{8,14}$/u.test(remote),
    );
  if (rows.length === 0) throw new Error("No migration history rows found");
  if (
    rows.some(
      ({ local, remote }) =>
        (local && !/^\d{8,14}$/u.test(local)) ||
        (remote && !/^\d{8,14}$/u.test(remote)),
    )
  ) {
    throw new Error("Migration history format is not recognized");
  }
  return rows;
}

export function validateMigrationHistory(rows, phase) {
  if (phase !== "pre" && phase !== "post") {
    throw new Error("Migration check phase must be pre or post");
  }
  const remote = rows.filter((row) => row.remote).map((row) => row.remote);
  const local = rows.filter((row) => row.local).map((row) => row.local);
  if (
    new Set(remote).size !== remote.length ||
    new Set(local).size !== local.length
  ) {
    throw new Error("Duplicate migration versions in history");
  }
  if (!rows.some((row) => row.local && row.local === row.remote)) {
    throw new Error(
      "Production migration baseline is absent; reconcile history first",
    );
  }
  if (rows.some((row) => row.remote && row.remote !== row.local)) {
    throw new Error("Production contains remote-only migrations");
  }
  const newestRemote = remote.reduce((latest, version) =>
    BigInt(version) > BigInt(latest) ? version : latest,
  );
  const pending = rows
    .filter((row) => row.local && !row.remote)
    .map((row) => row.local);
  if (pending.some((version) => BigInt(version) < BigInt(newestRemote))) {
    throw new Error("Production migration history has a historical gap");
  }
  if (phase === "post" && pending.length > 0) {
    throw new Error("Production migrations are still pending");
  }
  return pending;
}

export function validateHealth(healthJson, projectRef) {
  const health = JSON.parse(healthJson);
  if (
    health?.status !== "ok" ||
    health.supabaseOrigin !== projectOrigin(projectRef)
  ) {
    throw new Error("Deployment health uses a different Supabase project");
  }
}

function keyRole(key) {
  if (key.startsWith("sb_publishable_")) return "anon";
  if (key.startsWith("sb_secret_")) return "service_role";
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString()).role;
  } catch {
    return null;
  }
}

export async function validateAppConnection(
  vercelEnv,
  projectRef,
  request = fetch,
) {
  const environment = parseEnv(vercelEnv);
  const origin = projectOrigin(projectRef);
  if (
    !environment.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    keyRole(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) !== "anon"
  ) {
    throw new Error(
      "Vercel production public Supabase key is missing or unsafe",
    );
  }
  if (
    !environment.SUPABASE_SERVICE_ROLE_KEY ||
    keyRole(environment.SUPABASE_SERVICE_ROLE_KEY) !== "service_role"
  ) {
    throw new Error(
      "Vercel production private Supabase key is missing or invalid",
    );
  }
  if (
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY ===
    environment.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("Vercel production public and private keys must differ");
  }
  const checks = [
    {
      name: "Supabase anon key",
      path: "/auth/v1/settings",
      key: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    {
      name: "Supabase service role and migrated schema",
      path: "/rest/v1/candidate_evidence?select=fact_review&limit=0",
      key: environment.SUPABASE_SERVICE_ROLE_KEY,
    },
  ];
  for (const check of checks) {
    const headers = { apikey: check.key };
    if (check.key.split(".").length === 3) {
      headers.Authorization = `Bearer ${check.key}`;
    }
    const response = await request(new URL(check.path, origin), {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(
        `${check.name} failed validation (HTTP ${response.status})`,
      );
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const [, , check, argument, projectRef] = process.argv;
    if (check === "target") {
      validateTarget(readFileSync(argument, "utf8"), projectRef);
      console.log("Production deployment target verified");
    } else if (check === "history") {
      const pending = validateMigrationHistory(
        parseMigrationHistory(readFileSync(0, "utf8")),
        argument,
      );
      console.log(
        `Migration history verified; pending: ${pending.join(", ") || "none"}`,
      );
    } else if (check === "health") {
      validateHealth(readFileSync(0, "utf8"), argument);
      console.log("Deployment health verified");
    } else if (check === "app-connection") {
      await validateAppConnection(readFileSync(argument, "utf8"), projectRef);
      console.log("Vercel Supabase credentials and migrated schema verified");
    } else {
      throw new Error("Unknown production deployment check");
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Deployment check failed",
    );
    process.exitCode = 1;
  }
}
