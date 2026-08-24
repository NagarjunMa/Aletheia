import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readerSource = readFileSync(
  new URL("./linkedin-reader.js", import.meta.url),
  "utf8",
);
const popupSource = readFileSync(
  new URL("../popup/popup.js", import.meta.url),
  "utf8",
);
const popupMarkup = readFileSync(
  new URL("../popup/popup.html", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../settings/settings.js", import.meta.url),
  "utf8",
);

describe("profile-reading consent contract", () => {
  it("keeps the reader inert until consent and stops it after withdrawal", () => {
    expect(readerSource).toMatch(
      /chrome\.storage\.local\.get\(\s*PROFILE_EXTRACTION_CONSENT_KEY,?\s*\)/,
    );
    expect(readerSource).toContain("if (profileExtractionConsent) {");
    expect(readerSource).toContain("stopProfileExtraction();");
    expect(readerSource).toContain("Profile access requires consent.");
    expect(readerSource).toContain(
      "if (!profileExtractionConsent || !profileReaderActive) return null;",
    );
  });

  it("requires an affirmative Continue action before starting profile checks", () => {
    expect(popupMarkup).toContain('id="consentContinue"');
    expect(popupMarkup).toContain('id="consentNotNow"');
    expect(popupMarkup).toContain("Privacy policy");
    expect(popupSource).toContain("await hasProfileExtractionConsent()");
    expect(popupSource).toContain("await startProfileWorkflow();");
    expect(popupSource).toContain(
      "Profile reading is off. Select Continue when you are ready.",
    );
  });

  it("lets the user withdraw profile-reading permission in Settings", () => {
    expect(settingsSource).toContain("handleProfileExtractionConsentToggle");
    expect(settingsSource).toContain(
      "[PROFILE_EXTRACTION_CONSENT_KEY]: nextConsent",
    );
  });

  it("ignores delayed profile updates unless consent is still active", () => {
    expect(popupSource).toContain(
      "async function handleProfileUpdated(profile)",
    );
    expect(popupSource).toContain(
      "if (!(await hasProfileExtractionConsent())) return;",
    );
    expect(popupSource).toContain(
      "void handleProfileUpdated(message.profile);",
    );
  });
});
