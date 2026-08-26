import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const popupCss = readFileSync(new URL("./popup.css", import.meta.url), "utf8");
const settingsCss = readFileSync(
  new URL("../settings/settings.css", import.meta.url),
  "utf8",
);
const autoFillerSource = readFileSync(
  new URL("../content/auto-filler.js", import.meta.url),
  "utf8",
);

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex
      .replace("#", "")
      .match(/.{2}/g)!
      .map((value) => Number.parseInt(value, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );

    return (
      0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
    );
  };

  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("extension theme contract", () => {
  it.each([
    ["popup", popupCss],
    ["settings", settingsCss],
  ])("uses the Phthalo reference palette on %s", (_surface, css) => {
    expect(css.toLowerCase()).toContain("#020403");
    expect(css.toLowerCase()).toContain("#091814");
    expect(css.toLowerCase()).toContain("#10291f");
    expect(css.toLowerCase()).toContain("#285d49");
    expect(css.toLowerCase()).toContain("#5a9d82");
    expect(css.toLowerCase()).toContain("#78b49b");
    expect(css.toLowerCase()).toContain("#f7faf9");

    expect(css.toLowerCase()).not.toContain("#70b8c8");
    expect(css.toLowerCase()).not.toContain("#5888a0");
    expect(css.toLowerCase()).not.toContain("#285868");
    expect(css.toLowerCase()).not.toContain("#50c878");
    expect(css.toLowerCase()).not.toContain("#d1f2eb");
  });

  it("uses Phthalo feedback instead of the legacy blue fill treatment", () => {
    expect(autoFillerSource.toLowerCase()).toContain("#78b49b");
    expect(autoFillerSource.toLowerCase()).toContain("#285d49");
    expect(autoFillerSource.toLowerCase()).toContain("#f7faf9");
    expect(autoFillerSource.toLowerCase()).not.toContain("#2e5797");
    expect(autoFillerSource.toLowerCase()).not.toContain("#1e3a5f");
  });

  it("keeps core text and action pairs at WCAG AA contrast", () => {
    expect(contrastRatio("#f7faf9", "#020403")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#aebdb7", "#091814")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#f7faf9", "#285d49")).toBeGreaterThanOrEqual(4.5);
  });
});
