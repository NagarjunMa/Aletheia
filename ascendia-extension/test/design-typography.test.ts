import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const extensionRoot = path.resolve(import.meta.dirname, "..");

describe("extension typography", () => {
  it("bundles the UI font and its redistribution notice", () => {
    const font = readFileSync(
      path.join(extensionRoot, "assets/fonts/DM-Sans-Latin.woff2"),
    );
    const license = readFileSync(
      path.join(extensionRoot, "assets/fonts/OFL-DM-Sans.txt"),
      "utf8",
    );

    expect(font.subarray(0, 4).toString()).toBe("wOF2");
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it.each([
    ["popup/popup.css", "--font-family"],
    ["settings/settings.css", "--font-ui"],
  ])("reserves Flaviotte for the brand in %s", (file, uiToken) => {
    const css = readFileSync(path.join(extensionRoot, file), "utf8");
    const declaration = css.match(new RegExp(`${uiToken}:\\s*([^;]+);`));

    expect(declaration?.[1]).toMatch(/"DM Sans"/u);
    expect(declaration?.[1]).not.toMatch(/"Flaviotte"/u);
    expect(css).toMatch(/font-family:\s*"Flaviotte"/u);
  });
});
