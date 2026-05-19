#!/usr/bin/env node
// Bundle the Chrome extension and zip it into public/ascendia-extension.zip
// so the Next.js app can serve it as a static download.
//
// Runs:
//   - Via `npm run prebuild` → triggered automatically by `npm run build`
//     (Vercel runs `npm run build`, so production downloads stay fresh).
//   - Via `.husky/pre-commit` when ascendia-extension/** files change.
//   - Manually: `node scripts/build-extension-zip.mjs`
//
// The zip is gitignored — it's a build artifact, regenerated each deploy.

import * as esbuild from 'esbuild'
import JSZip from 'jszip'
import { execSync } from 'node:child_process'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
const EXT_DIR = path.join(ROOT, 'ascendia-extension')
const DIST_DIR = path.join(EXT_DIR, 'dist')
const PUBLIC_DIR = path.join(ROOT, 'public')
const OUT_ZIP = path.join(PUBLIC_DIR, 'ascendia-extension.zip')
const VERSION_FILE = path.join(PUBLIC_DIR, 'ascendia-extension.version.json')

const ENTRY_POINTS = [
  'background/service-worker.js',
  'content/linkedin-reader.js',
  'content/auto-filler.js',
  'content/auth-bridge.js',
  'popup/popup.js',
  'settings/settings.js',
]

// Files copied verbatim into the zip alongside the bundled JS.
// Order: manifest first, then static assets, then bundled JS overlay.
const STATIC_INCLUDES = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.css',
  'settings/settings.html',
  'settings/settings.css',
  'icons/',
  'lib/',
]

function log(msg) {
  process.stdout.write(`[ext-zip] ${msg}\n`)
}

function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT })
      .toString()
      .trim()
  } catch {
    return 'untracked'
  }
}

async function bundleExtension() {
  log('bundling extension via esbuild')
  await esbuild.build({
    entryPoints: ENTRY_POINTS.map((e) => path.join(EXT_DIR, e)),
    bundle: true,
    outdir: DIST_DIR,
    format: 'iife',
    target: 'chrome120',
    sourcemap: false,
    logLevel: 'warning',
    absWorkingDir: EXT_DIR,
  })
}

function walkDir(dirAbs, baseAbs) {
  const out = []
  for (const entry of readdirSync(dirAbs)) {
    const full = path.join(dirAbs, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      // Skip hidden + heavy dirs
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'coverage' || entry === 'test') continue
      out.push(...walkDir(full, baseAbs))
    } else {
      // Skip system + test files
      if (entry === '.DS_Store') continue
      if (entry.endsWith('.test.ts') || entry.endsWith('.test.js')) continue
      out.push({ abs: full, rel: path.relative(baseAbs, full) })
    }
  }
  return out
}

async function addPathToZip(zip, srcPath, destPath) {
  const st = await stat(srcPath)
  if (st.isDirectory()) {
    for (const file of walkDir(srcPath, EXT_DIR)) {
      const data = await readFile(file.abs)
      zip.file(file.rel, data)
    }
  } else {
    const data = await readFile(srcPath)
    zip.file(destPath, data)
  }
}

async function buildZip() {
  await mkdir(PUBLIC_DIR, { recursive: true })

  const zip = new JSZip()

  // Static includes (manifest, html/css, icons, vendored libs)
  for (const item of STATIC_INCLUDES) {
    const src = path.join(EXT_DIR, item)
    try {
      await addPathToZip(zip, src, item.replace(/\/$/, ''))
    } catch (err) {
      log(`warn: skipped missing path ${item}: ${err.message}`)
    }
  }

  // Bundled JS from dist/ — overlays/replaces any source JS that was scraped above
  for (const entry of ENTRY_POINTS) {
    const builtPath = path.join(DIST_DIR, entry)
    try {
      const data = await readFile(builtPath)
      zip.file(entry, data)
    } catch (err) {
      throw new Error(`Bundled entry missing: ${entry} (${err.message})`)
    }
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  await writeFile(OUT_ZIP, buffer)

  // Read manifest version for the metadata sidecar
  const manifest = JSON.parse(
    await readFile(path.join(EXT_DIR, 'manifest.json'), 'utf8'),
  )

  const meta = {
    version: manifest.version,
    sha: getGitSha(),
    builtAt: new Date().toISOString(),
    sizeBytes: buffer.byteLength,
  }
  await writeFile(VERSION_FILE, JSON.stringify(meta, null, 2))

  log(`wrote ${path.relative(ROOT, OUT_ZIP)} (${(buffer.byteLength / 1024).toFixed(1)} KB)`)
  log(`wrote ${path.relative(ROOT, VERSION_FILE)} (v${meta.version} @ ${meta.sha})`)
}

async function main() {
  const t0 = Date.now()
  await bundleExtension()
  await buildZip()
  log(`done in ${Date.now() - t0}ms`)
}

main().catch((err) => {
  process.stderr.write(`[ext-zip] FAILED: ${err.message}\n`)
  process.exit(1)
})
