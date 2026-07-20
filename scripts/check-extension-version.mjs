#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "ascendia-extension/manifest.json";

const PACKAGED_PREFIXES = [
  "ascendia-extension/background/",
  "ascendia-extension/content/",
  "ascendia-extension/popup/",
  "ascendia-extension/settings/",
  "ascendia-extension/icons/",
  "ascendia-extension/assets/",
];

const EXCLUDED_PACKAGED_FILES = new Set([
  "ascendia-extension/background/auth-core.js",
  "ascendia-extension/content/profile-extractor.js",
  "ascendia-extension/content/filler-core.js",
  "ascendia-extension/popup/popup-core.js",
]);

function parseVersion(version) {
  if (!/^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/.test(version)) {
    return null;
  }
  const parts = version.split(".").map(Number);
  if (parts.some((part) => part > 65_535)) return null;
  return [...parts, 0, 0, 0, 0].slice(0, 4);
}

export function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) {
    throw new Error(`Invalid Chrome extension version: ${left}, ${right}`);
  }
  for (let index = 0; index < 4; index += 1) {
    if (leftParts[index] < rightParts[index]) return -1;
    if (leftParts[index] > rightParts[index]) return 1;
  }
  return 0;
}

export function isPackagedExtensionPath(filePath) {
  if (filePath === MANIFEST_PATH) return true;
  if (filePath === "scripts/build-extension-zip.mjs") return true;
  if (EXCLUDED_PACKAGED_FILES.has(filePath)) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(filePath)) return false;
  if (filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) return false;
  return PACKAGED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

export function validateExtensionVersionPolicy({
  changedFiles,
  baseVersion,
  currentVersion,
  packageVersion,
}) {
  if (currentVersion !== packageVersion) {
    throw new Error(
      `Extension version drift: manifest is ${currentVersion}, package is ${packageVersion}`,
    );
  }

  const packagedChanges = changedFiles.filter(isPackagedExtensionPath);
  if (packagedChanges.length === 0) {
    return { requiresVersionBump: false, packagedChanges };
  }

  if (compareVersions(currentVersion, baseVersion) <= 0) {
    throw new Error(
      `Packaged extension files changed, but manifest version ${currentVersion} is not greater than base version ${baseVersion}`,
    );
  }

  return { requiresVersionBump: true, packagedChanges };
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

async function run() {
  const baseRef = process.argv[2] || process.env.EXTENSION_VERSION_BASE_REF;
  if (!baseRef) {
    throw new Error(
      "Provide a base Git ref: node scripts/check-extension-version.mjs <base-ref>",
    );
  }

  const committedChanges = git(["diff", "--name-only", `${baseRef}...HEAD`]);
  const workingTreeChanges = git(["diff", "--name-only", "HEAD"]);
  const changedFiles = [
    ...new Set(
      [committedChanges, workingTreeChanges]
        .filter(Boolean)
        .flatMap((output) => output.split("\n")),
    ),
  ];
  const baseManifest = JSON.parse(git(["show", `${baseRef}:${MANIFEST_PATH}`]));
  const currentManifest = JSON.parse(
    await readFile(path.join(ROOT, MANIFEST_PATH), "utf8"),
  );
  const extensionPackage = JSON.parse(
    await readFile(
      path.join(ROOT, "ascendia-extension", "package.json"),
      "utf8",
    ),
  );

  const result = validateExtensionVersionPolicy({
    changedFiles,
    baseVersion: baseManifest.version,
    currentVersion: currentManifest.version,
    packageVersion: extensionPackage.version,
  });

  if (!result.requiresVersionBump) {
    process.stdout.write("No packaged extension changes detected.\n");
    return;
  }

  process.stdout.write(
    `Extension version ${baseManifest.version} -> ${currentManifest.version} covers ${result.packagedChanges.length} packaged file change(s).\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    process.stderr.write(`[extension-version] ${error.message}\n`);
    process.exitCode = 1;
  });
}
