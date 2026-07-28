import * as esbuild from "esbuild";
import { access, cp, mkdir, rm } from "node:fs/promises";

const isWatch = process.argv.includes("--watch");
const outdir = "dist";

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
  sourcemap: true,
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
  "background/service-worker.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "settings/settings.html",
  "settings/settings.css",
  "settings/settings.js",
  "icons/icon-16.png",
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
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await esbuild.build(buildOptions);
  await copyStaticFiles();
  await verifyLoadableBuild();
}
