import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compareChromeExtensionVersions,
  CURRENT_EXTENSION_API_VERSION,
  evaluateExtensionContract,
  getExtensionContractResponseHeaders,
  isValidChromeExtensionVersion,
  LEGACY_EXTENSION_VERSION,
} from "./extension-contract";

function headers(values: Record<string, string> = {}): Headers {
  return new Headers(values);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Chrome extension version utilities", () => {
  it.each(["0", "1", "1.0", "1.0.3", "1.2.3.4", "65535.0.0.1"])(
    "accepts valid Chrome version %s",
    (version) => {
      expect(isValidChromeExtensionVersion(version)).toBe(true);
    },
  );

  it.each(["", "01.0", "1.0.0.0.1", "65536", "1.0.0-beta", "v1.0.0"])(
    "rejects invalid Chrome version %s",
    (version) => {
      expect(isValidChromeExtensionVersion(version)).toBe(false);
    },
  );

  it("compares versions using Chrome's numeric component ordering", () => {
    expect(compareChromeExtensionVersions("1.0.3", "1.0.2")).toBe(1);
    expect(compareChromeExtensionVersions("1.0", "1.0.0.0")).toBe(0);
    expect(compareChromeExtensionVersions("1.9.9", "1.10.0")).toBe(-1);
  });
});

describe("evaluateExtensionContract", () => {
  it("accepts headerless 1.0.2 clients as legacy API v1", () => {
    expect(evaluateExtensionContract(headers())).toEqual({
      compatible: true,
      apiVersion: CURRENT_EXTENSION_API_VERSION,
      extensionVersion: LEGACY_EXTENSION_VERSION,
      legacyClient: true,
    });
  });

  it("accepts an explicit 1.0.3 API v1 client", () => {
    expect(
      evaluateExtensionContract(
        headers({
          "X-Aletheia-API-Version": "1",
          "X-Aletheia-Extension-Version": "1.0.3",
        }),
      ),
    ).toEqual({
      compatible: true,
      apiVersion: "1",
      extensionVersion: "1.0.3",
      legacyClient: false,
    });
  });

  it("rejects an unsupported API version", () => {
    const result = evaluateExtensionContract(
      headers({
        "X-Aletheia-API-Version": "2",
        "X-Aletheia-Extension-Version": "1.0.3",
      }),
    );

    expect(result).toMatchObject({
      compatible: false,
      status: 426,
      body: {
        code: "API_VERSION_UNSUPPORTED",
        requestedApiVersion: "2",
      },
    });
  });

  it("rejects an invalid explicit extension version", () => {
    const result = evaluateExtensionContract(
      headers({
        "X-Aletheia-API-Version": "1",
        "X-Aletheia-Extension-Version": "v1.0.3",
      }),
    );

    expect(result).toMatchObject({
      compatible: false,
      status: 400,
      body: { code: "INVALID_EXTENSION_VERSION" },
    });
  });

  it("rejects a client below the configured minimum version", () => {
    vi.stubEnv("MINIMUM_SUPPORTED_EXTENSION_VERSION", "1.0.3");
    vi.stubEnv("CHROME_WEB_STORE_PUBLISHED_VERSION", "1.0.3");

    const result = evaluateExtensionContract(
      headers({
        "X-Aletheia-API-Version": "1",
        "X-Aletheia-Extension-Version": "1.0.2",
      }),
    );

    expect(result).toMatchObject({
      compatible: false,
      status: 426,
      body: {
        code: "EXTENSION_UPDATE_REQUIRED",
        installedVersion: "1.0.2",
        minimumSupportedExtensionVersion: "1.0.3",
        latestPublishedExtensionVersion: "1.0.3",
      },
    });
  });

  it("publishes current contract metadata in response headers", () => {
    expect(getExtensionContractResponseHeaders()).toEqual({
      "X-Aletheia-API-Version": "1",
      "X-Aletheia-Minimum-Extension-Version": "1.0.2",
    });
  });
});
