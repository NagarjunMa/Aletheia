import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import JSZip from "jszip";
import { expect, it } from "vitest";

it("packages loadable bundled scripts, manifest paths and required assets", async () => {
  execFileSync(process.execPath, ["scripts/build-extension-zip.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const zip = await JSZip.loadAsync(
    await readFile("ascendia-extension/dist/aletheia-extension.zip"),
  );
  const manifest = JSON.parse(
    await zip.file("manifest.json")!.async("string"),
  ) as {
    content_scripts: { js: string[] }[];
    background: { service_worker: string };
    side_panel: { default_path: string };
    options_page: string;
  };
  for (const entry of manifest.content_scripts.flatMap(({ js }) => js)) {
    const source = await zip.file(entry)!.async("string");
    expect(() => new Script(source, { filename: entry })).not.toThrow();
  }
  for (const entry of [
    manifest.background.service_worker,
    manifest.side_panel.default_path,
    manifest.options_page,
    "content/auth-bridge.js",
    "popup/popup.js",
    "settings/settings.js",
  ]) {
    expect(zip.file(entry), entry).not.toBeNull();
  }
  expect(zip.file("assets/thinking-orbs-engine.js")).not.toBeNull();
  expect(zip.file("assets/LICENSE.thinking-orbs")).not.toBeNull();
  for (const size of [16, 32, 48, 128]) {
    const iconPath = `icons/icon-${size}.png`;
    expect(await zip.file(iconPath)?.async("nodebuffer")).toEqual(
      await readFile(`ascendia-extension/${iconPath}`),
    );
  }
  expect(
    Object.keys(zip.files).some((name) =>
      /(?:\.(?:test|spec)\.[jt]s|\.map)$/.test(name),
    ),
  ).toBe(false);
}, 20_000);
