import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const popupSource = readFileSync(
  new URL("./popup.js", import.meta.url),
  "utf8",
);

describe("popup authentication recovery UI", () => {
  it("renders the re-authentication action on both the main and setup screens", () => {
    expect(popupSource).toContain('document.getElementById("errorMessage") ||');
    expect(popupSource).toContain('document.getElementById("authError")');
    expect(popupSource).toContain('document.getElementById("authErrorText")');
    expect(popupSource).toContain('reauthBtn.textContent = "Re-authenticate"');
  });

  it("reloads after successful re-authentication instead of relying on removed main content", () => {
    expect(popupSource).toContain("window.location.reload()");
    expect(popupSource).toContain("showAuthError(");
  });
});
