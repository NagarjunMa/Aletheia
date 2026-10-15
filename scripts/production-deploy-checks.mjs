import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function validateProjectRef(projectRef) {
  if (!/^[a-z0-9]{20}$/u.test(projectRef)) {
    throw new Error(
      "Production Supabase project reference is missing or invalid",
    );
  }
}

export function validateProductionAppTarget(healthResponse, projectRef) {
  validateProjectRef(projectRef);
  let health;
  try {
    health = JSON.parse(healthResponse);
  } catch {
    throw new Error("Production app health response is not valid JSON");
  }
  const expectedOrigin = `https://${projectRef}.supabase.co`;
  if (health?.status !== "ok" || health.supabaseOrigin !== expectedOrigin) {
    throw new Error(
      "Production app Supabase target does not match the migration project",
    );
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const [, , check, argument] = process.argv;
    if (check === "project-ref") {
      validateProjectRef(argument);
      console.log("Production Supabase project reference verified");
    } else if (check === "production-target") {
      validateProductionAppTarget(readFileSync(0, "utf8"), argument);
      console.log("Production app and migration project targets match");
    } else if (check === "history") {
      const pending = validateMigrationHistory(
        parseMigrationHistory(readFileSync(0, "utf8")),
        argument,
      );
      console.log(
        `Migration history verified; pending: ${pending.join(", ") || "none"}`,
      );
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
