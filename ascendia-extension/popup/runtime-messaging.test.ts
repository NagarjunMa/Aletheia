import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const popupSource = readFileSync(
  new URL("./popup.js", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../settings/settings.js", import.meta.url),
  "utf8",
);

describe("extension runtime messaging diagnostics", () => {
  it.each([
    ["popup", popupSource],
    ["settings", settingsSource],
  ])("surfaces background-worker failures in the %s UI", (_name, source) => {
    expect(source).toContain("chrome.runtime.lastError");
    expect(source).toContain("BACKGROUND_UNAVAILABLE");
    expect(source).toContain("The extension background service is unavailable");
    expect(source).not.toContain("void chrome.runtime.lastError");
  });
});
