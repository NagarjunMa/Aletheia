#!/usr/bin/env node
// Bundle the Chrome extension into a local artifact for Chrome Web Store upload.
//
// Runs:
//   - Via `.husky/pre-commit` when ascendia-extension/** files change.
//   - Manually: `node scripts/build-extension-zip.mjs`
//
// The zip is gitignored and is not written to public/ or deployed by Vercel.

import JSZip from "jszip";
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const EXT_DIR = path.join(ROOT, "ascendia-extension");
const DIST_DIR = path.join(EXT_DIR, "dist");
const OUT_ZIP = path.join(DIST_DIR, "aletheia-extension.zip");
const VERSION_FILE = path.join(DIST_DIR, "aletheia-extension.version.json");

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

async function buildZip() {
  const buildDir = await mkdtemp(path.join(tmpdir(), "aletheia-extension-"));
  let buffer;
  let manifest;
  try {
    // Manifest content scripts must be classic JavaScript. Package the same
    // bundled entry points as the unpacked Chrome build.
    execFileSync(
      process.execPath,
      ["build.mjs", `--artifact-dir=${buildDir}`],
      {
        cwd: EXT_DIR,
        stdio: "inherit",
      },
    );
    manifest = JSON.parse(
      await readFile(path.join(buildDir, "manifest.json"), "utf8"),
    );
    const zip = new JSZip();
    for (const entry of await readdir(buildDir, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || entry.name === ".DS_Store") continue;
      const file = path.join(entry.parentPath, entry.name);
      zip.file(
        path.relative(buildDir, file).split(path.sep).join("/"),
        await readFile(file),
      );
    }
    buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  } finally {
    await rm(buildDir, { recursive: true, force: true });
  }

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
  await mkdir(DIST_DIR, { recursive: true });
  await writeFile(OUT_ZIP, buffer);

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
