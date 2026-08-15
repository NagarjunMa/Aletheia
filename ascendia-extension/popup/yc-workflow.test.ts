import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const popupHtml = readFileSync(
  new URL("./popup.html", import.meta.url),
  "utf8",
);
const popupSource = readFileSync(
  new URL("./popup.js", import.meta.url),
  "utf8",
);

describe("YC application popup contract", () => {
  it("offers an accessible YC category, required job description, and editable question", () => {
    expect(popupHtml).toContain('<option value="yc_application">');
    expect(popupHtml).toContain('id="ycQuestionGroup"');
    expect(popupHtml).toContain('label for="ycQuestionInput"');
    expect(popupHtml).toContain('id="ycQuestionInput"');
    expect(popupHtml).toContain('aria-live="polite"');
    expect(popupHtml).toMatch(
      /id="errorMessage"[\s\S]*?role="alert"[\s\S]*?tabindex="-1"/,
    );
  });

  it("uses the tested core contract and keeps YC inputs out of local storage", () => {
    expect(popupSource).toContain('from "./popup-core.js"');
    expect(popupSource).toContain("buildGeneratePayload(");
    expect(popupSource).toContain("validateGenerationInput(");
    expect(popupSource).toContain("category === YC_APPLICATION_CATEGORY");
    expect(popupSource).toContain("inputs: isYcApplication");
    expect(popupSource).toContain("? { category }");
  });

  it("shows copy, regenerate, feedback, and profile-readiness actions", () => {
    expect(popupHtml).toContain('id="copyAllBtn"');
    expect(popupHtml).toContain('id="rejectBtn"');
    expect(popupHtml).toContain('id="acceptBtn"');
    expect(popupHtml).toContain('id="errorAction"');
    expect(popupSource).toContain("getGenerationErrorPresentation(");
  });
});
