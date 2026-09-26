import { describe, expect, it } from "vitest";

import {
  compareVersions,
  isPackagedExtensionPath,
  validateExtensionVersionPolicy,
} from "./check-extension-version.mjs";

describe("extension version guard", () => {
  it("classifies installed files and packaging changes", () => {
    expect(
      isPackagedExtensionPath(
        "ascendia-extension/background/service-worker.js",
      ),
    ).toBe(true);
    expect(
      isPackagedExtensionPath("ascendia-extension/assets/fonts/font.woff2"),
    ).toBe(true);
    expect(
      isPackagedExtensionPath("ascendia-extension/lib/account-owned-cache.js"),
    ).toBe(true);
    expect(isPackagedExtensionPath("scripts/build-extension-zip.mjs")).toBe(
      true,
    );
  });

  it("ignores tests, TypeScript sources, and explicitly excluded prototypes", () => {
    expect(
      isPackagedExtensionPath("ascendia-extension/background/auth-core.js"),
    ).toBe(false);
    expect(
      isPackagedExtensionPath("ascendia-extension/popup/popup.test.ts"),
    ).toBe(false);
    expect(
      isPackagedExtensionPath("ascendia-extension/content/new-source.ts"),
    ).toBe(false);
  });

  it("requires an increased manifest version for packaged changes", () => {
    expect(() =>
      validateExtensionVersionPolicy({
        changedFiles: ["ascendia-extension/popup/popup.js"],
        baseVersion: "1.0.2",
        currentVersion: "1.0.2",
        packageVersion: "1.0.2",
      }),
    ).toThrow("is not greater than base version");
  });

  it("accepts a valid packaged release version increase", () => {
    expect(
      validateExtensionVersionPolicy({
        changedFiles: ["ascendia-extension/popup/popup.js"],
        baseVersion: "1.0.2",
        currentVersion: "1.0.3",
        packageVersion: "1.0.3",
      }),
    ).toMatchObject({ requiresVersionBump: true });
  });

  it("rejects manifest and package version drift", () => {
    expect(() =>
      validateExtensionVersionPolicy({
        changedFiles: [],
        baseVersion: "1.0.2",
        currentVersion: "1.0.3",
        packageVersion: "1.1.0",
      }),
    ).toThrow("Extension version drift");
  });

  it("uses Chrome numeric ordering", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
  });
});
