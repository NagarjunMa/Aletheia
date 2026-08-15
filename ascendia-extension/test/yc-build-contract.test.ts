import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const zipBuilder = readFileSync(
  new URL("../../scripts/build-extension-zip.mjs", import.meta.url),
  "utf8",
);
const extensionBuilder = readFileSync(
  new URL("../build.mjs", import.meta.url),
  "utf8",
);

describe("YC extension artifact contract", () => {
  it("ships the popup core module in both dist and Chrome Web Store ZIP builds", () => {
    expect(zipBuilder).not.toContain("'popup/popup-core.js',");
    expect(extensionBuilder).toContain('"popup/popup.js"');
  });

  it("marks artifacts built from uncommitted extension work as dirty", () => {
    expect(zipBuilder).toContain("status --porcelain");
    expect(zipBuilder).toContain("`${sha}-dirty`");
  });
});
