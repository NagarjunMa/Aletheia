#!/usr/bin/env node
// Bundle the Chrome extension into a local artifact for Chrome Web Store upload.
//
// Runs:
//   - Via `.husky/pre-commit` when ascendia-extension/** files change.
//   - Manually: `node scripts/build-extension-zip.mjs`
//
// The zip is gitignored and is not written to public/ or deployed by Vercel.

import JSZip from "jszip";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const EXT_DIR = path.join(ROOT, "ascendia-extension");
const DIST_DIR = path.join(EXT_DIR, "dist");
const OUT_ZIP = path.join(DIST_DIR, "aletheia-extension.zip");
const VERSION_FILE = path.join(DIST_DIR, "aletheia-extension.version.json");

// Extension source ships as plain MV3 modules — no bundling. Runtime imports
// must therefore be present beside their entry points in the ZIP artifact.
const STATIC_INCLUDES = [
  "manifest.json",
  "background/",
  "content/",
  "popup/",
  "settings/",
  "lib/",
  "icons/",
  "assets/",
];

// Pure helpers not referenced by runtime modules remain excluded from the ZIP.
const EXCLUDED_FILES = new Set([
  "background/auth-core.js",
  "content/profile-extractor.js",
  "content/filler-core.js",
]);

function log(msg) {
  process.stdout.write(`[ext-zip] ${msg}\n`);
}

function getGitSha() {
  try {
    const sha = execSync("git rev-parse --short HEAD", { cwd: ROOT })
      .toString()
      .trim();
    const isDirty = Boolean(
      execSync("git status --porcelain --untracked-files=normal", { cwd: ROOT })
        .toString()
        .trim(),
    );
    return isDirty ? `${sha}-dirty` : sha;
  } catch {
    return "untracked";
  }
}

function walkDir(dirAbs, baseAbs) {
  const out = [];
  for (const entry of readdirSync(dirAbs)) {
    const full = path.join(dirAbs, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip hidden + heavy + build dirs
      if (
        entry.startsWith(".") ||
        entry === "node_modules" ||
        entry === "coverage" ||
        entry === "test" ||
        entry === "dist"
      ) {
        continue;
      }
      out.push(...walkDir(full, baseAbs));
    } else {
      // Skip system + test + typing files
      if (entry === ".DS_Store") continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.js")) continue;
      if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) continue;
      const rel = path.relative(baseAbs, full);
      if (EXCLUDED_FILES.has(rel)) continue;
      out.push({ abs: full, rel });
    }
  }
  return out;
}

async function addPathToZip(zip, srcPath, destPath) {
  const st = await stat(srcPath);
  if (st.isDirectory()) {
    for (const file of walkDir(srcPath, EXT_DIR)) {
      const data = await readFile(file.abs);
      zip.file(file.rel, data);
    }
  } else {
    const data = await readFile(srcPath);
    zip.file(destPath, data);
  }
}

async function buildZip() {
  await mkdir(DIST_DIR, { recursive: true });

  const zip = new JSZip();

  // Copy all runtime extension files verbatim (no bundling).
  for (const item of STATIC_INCLUDES) {
    const src = path.join(EXT_DIR, item);
    try {
      await addPathToZip(zip, src, item.replace(/\/$/, ""));
    } catch (err) {
      log(`warn: skipped missing path ${item}: ${err.message}`);
    }
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  await writeFile(OUT_ZIP, buffer);

  // Read manifest version for the metadata sidecar
  const manifest = JSON.parse(
    await readFile(path.join(EXT_DIR, "manifest.json"), "utf8"),
  );
  const authSource = await readFile(
    path.join(EXT_DIR, "background", "auth.js"),
    "utf8",
  );
  const apiVersionMatch = authSource.match(
    /const ALETHEIA_API_VERSION = ["']([^"']+)["']/,
  );
  if (!apiVersionMatch) {
    throw new Error(
      "Could not read ALETHEIA_API_VERSION from background/auth.js",
    );
  }

  const meta = {
    version: manifest.version,
    apiVersion: apiVersionMatch[1],
    sha: getGitSha(),
    builtAt: new Date().toISOString(),
    sizeBytes: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    chromeWebStoreItemId: process.env.CHROME_WEB_STORE_ITEM_ID ?? null,
  };
  await writeFile(VERSION_FILE, JSON.stringify(meta, null, 2));

  log(
    `wrote ${path.relative(ROOT, OUT_ZIP)} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
  );
  log(
    `wrote ${path.relative(ROOT, VERSION_FILE)} (v${meta.version} @ ${meta.sha})`,
  );
}

async function main() {
  const t0 = Date.now();
  await buildZip();
  log(`done in ${Date.now() - t0}ms`);
}

main().catch((err) => {
  process.stderr.write(`[ext-zip] FAILED: ${err.message}\n`);
  process.exit(1);
});
