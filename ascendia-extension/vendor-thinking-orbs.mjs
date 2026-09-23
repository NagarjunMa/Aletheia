import { build } from "esbuild";
import { copyFile, readFile } from "node:fs/promises";

// The Chrome Web Store ZIP ships source modules without node_modules. Keep the
// renderer-only module and its license beside the popup as browser ESM assets.
const { version } = JSON.parse(
  await readFile("node_modules/thinking-orbs/package.json", "utf8"),
);
await build({
  entryPoints: ["node_modules/thinking-orbs/dist/engine.es.js"],
  outfile: "assets/thinking-orbs-engine.js",
  bundle: true,
  format: "esm",
  target: "chrome120",
  minify: true,
  legalComments: "inline",
  banner: {
    js: `// Vendored browser ESM renderer from thinking-orbs@${version}; see LICENSE.thinking-orbs.`,
  },
});
await copyFile(
  "node_modules/thinking-orbs/LICENSE",
  "assets/LICENSE.thinking-orbs",
);
