import * as esbuild from "esbuild";
import { access, cp, mkdir, rm } from "node:fs/promises";

const isWatch = process.argv.includes("--watch");
const artifactDir = process.argv
  .find((argument) => argument.startsWith("--artifact-dir="))
  ?.slice("--artifact-dir=".length);
const outdir = artifactDir || "dist";

const buildOptions = {
  entryPoints: [
    "background/service-worker.js",
    "content/linkedin-reader.js",
    "content/auto-filler.js",
    "content/auth-bridge.js",
    "popup/popup.js",
    "settings/settings.js",
  ],
  bundle: true,
  outdir,
  format: "iife",
  target: "chrome120",
  sourcemap: !artifactDir,
  logLevel: "info",
};

const staticPaths = [
  "manifest.json",
  "popup/popup.html",
  "popup/popup.css",
  "settings/settings.html",
  "settings/settings.css",
  "icons",
  "assets",
];

const requiredBuildFiles = [
  "manifest.json",
  ...buildOptions.entryPoints,
  "popup/popup.html",
  "popup/popup.css",
  "settings/settings.html",
  "settings/settings.css",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];

async function copyStaticFiles() {
  await Promise.all(
    staticPaths.map((source) =>
      cp(source, `${outdir}/${source}`, { recursive: true }),
    ),
  );
}

async function verifyLoadableBuild() {
  await Promise.all(
    requiredBuildFiles.map((file) => access(`${outdir}/${file}`)),
  );
}

if (isWatch) {
  await mkdir(outdir, { recursive: true });
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  await copyStaticFiles();
  await verifyLoadableBuild();
  console.log("Watching for changes...");
} else {
  if (!artifactDir) await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await esbuild.build(buildOptions);
  await copyStaticFiles();
  await verifyLoadableBuild();
}
