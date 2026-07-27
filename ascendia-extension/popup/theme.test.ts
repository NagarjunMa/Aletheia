import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const popupCss = readFileSync(new URL("./popup.css", import.meta.url), "utf8");
const settingsCss = readFileSync(
  new URL("../settings/settings.css", import.meta.url),
  "utf8",
);

describe("extension theme contract", () => {
  it.each([
    ["popup", popupCss],
    ["settings", settingsCss],
  ])("uses the evergreen reference palette on %s", (_surface, css) => {
    expect(css.toLowerCase()).toContain("#050806");
    expect(css.toLowerCase()).toContain("#013220");
    expect(css.toLowerCase()).toContain("#0b6e4f");
    expect(css.toLowerCase()).toContain("#50c878");
    expect(css.toLowerCase()).toContain("#d1f2eb");

    expect(css.toLowerCase()).not.toContain("#70b8c8");
    expect(css.toLowerCase()).not.toContain("#5888a0");
    expect(css.toLowerCase()).not.toContain("#285868");
  });
});
