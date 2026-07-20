export const EXTENSION_API_VERSION_HEADER = "x-aletheia-api-version";
export const EXTENSION_VERSION_HEADER = "x-aletheia-extension-version";

export const CURRENT_EXTENSION_API_VERSION = "1";
export const SUPPORTED_EXTENSION_API_VERSIONS = ["1"] as const;
export const LEGACY_EXTENSION_VERSION = "1.0.2";

const CHROME_VERSION_PATTERN = /^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/;
const MAX_CHROME_VERSION_COMPONENT = 65_535;

type HeaderReader = {
  get(_name: string): string | null;
};

type CompatibleExtensionContract = {
  compatible: true;
  apiVersion: string;
  extensionVersion: string;
  legacyClient: boolean;
};

type IncompatibleExtensionContract = {
  compatible: false;
  status: 400 | 426;
  body: {
    error: string;
    code:
      | "INVALID_EXTENSION_VERSION"
      | "API_VERSION_UNSUPPORTED"
      | "EXTENSION_UPDATE_REQUIRED";
    installedVersion?: string;
    requestedApiVersion?: string;
    currentApiVersion: string;
    supportedApiVersions: readonly string[];
    minimumSupportedExtensionVersion: string;
    latestPublishedExtensionVersion: string;
    chromeWebStoreUrl: string | null;
  };
};

export type ExtensionContractResult =
  | CompatibleExtensionContract
  | IncompatibleExtensionContract;

function parseChromeVersion(version: string): number[] | null {
  if (!CHROME_VERSION_PATTERN.test(version)) return null;

  const parts = version.split(".").map(Number);
  if (parts.some((part) => part > MAX_CHROME_VERSION_COMPONENT)) return null;

  return [...parts, 0, 0, 0, 0].slice(0, 4);
}

export function isValidChromeExtensionVersion(version: string): boolean {
  return parseChromeVersion(version) !== null;
}

export function compareChromeExtensionVersions(
  left: string,
  right: string,
): number {
  const leftParts = parseChromeVersion(left);
  const rightParts = parseChromeVersion(right);

  if (!leftParts || !rightParts) {
    throw new Error(
      `Invalid Chrome extension version comparison: ${left}, ${right}`,
    );
  }

  for (let index = 0; index < 4; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }

  return 0;
}

function configuredChromeVersion(name: string, fallback: string): string {
  const configured = process.env[name]?.trim();
  if (!configured) return fallback;
  if (!isValidChromeExtensionVersion(configured)) {
    throw new Error(`${name} must be a valid Chrome extension version`);
  }
  return configured;
}

export function getMinimumSupportedExtensionVersion(): string {
  return configuredChromeVersion(
    "MINIMUM_SUPPORTED_EXTENSION_VERSION",
    LEGACY_EXTENSION_VERSION,
  );
}

export function getPublishedExtensionVersion(): string {
  return configuredChromeVersion(
    "CHROME_WEB_STORE_PUBLISHED_VERSION",
    LEGACY_EXTENSION_VERSION,
  );
}

export function getChromeWebStoreUrl(): string | null {
  return process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL?.trim() || null;
}

export function getExtensionContractResponseHeaders(): Record<string, string> {
  return {
    "X-Aletheia-API-Version": CURRENT_EXTENSION_API_VERSION,
    "X-Aletheia-Minimum-Extension-Version":
      getMinimumSupportedExtensionVersion(),
  };
}

export function evaluateExtensionContract(
  headers: HeaderReader,
): ExtensionContractResult {
  const explicitApiVersion = headers.get(EXTENSION_API_VERSION_HEADER)?.trim();
  const explicitExtensionVersion = headers
    .get(EXTENSION_VERSION_HEADER)
    ?.trim();
  const apiVersion = explicitApiVersion || CURRENT_EXTENSION_API_VERSION;
  const extensionVersion = explicitExtensionVersion || LEGACY_EXTENSION_VERSION;
  const minimumSupportedExtensionVersion =
    getMinimumSupportedExtensionVersion();
  const latestPublishedExtensionVersion = getPublishedExtensionVersion();
  const chromeWebStoreUrl = getChromeWebStoreUrl();

  if (
    !SUPPORTED_EXTENSION_API_VERSIONS.includes(
      apiVersion as (typeof SUPPORTED_EXTENSION_API_VERSIONS)[number],
    )
  ) {
    return {
      compatible: false,
      status: 426,
      body: {
        error: "This API contract version is not supported.",
        code: "API_VERSION_UNSUPPORTED",
        requestedApiVersion: apiVersion,
        currentApiVersion: CURRENT_EXTENSION_API_VERSION,
        supportedApiVersions: SUPPORTED_EXTENSION_API_VERSIONS,
        minimumSupportedExtensionVersion,
        latestPublishedExtensionVersion,
        chromeWebStoreUrl,
      },
    };
  }

  if (!isValidChromeExtensionVersion(extensionVersion)) {
    return {
      compatible: false,
      status: 400,
      body: {
        error: "The extension version header is invalid.",
        code: "INVALID_EXTENSION_VERSION",
        installedVersion: extensionVersion,
        currentApiVersion: CURRENT_EXTENSION_API_VERSION,
        supportedApiVersions: SUPPORTED_EXTENSION_API_VERSIONS,
        minimumSupportedExtensionVersion,
        latestPublishedExtensionVersion,
        chromeWebStoreUrl,
      },
    };
  }

  if (
    compareChromeExtensionVersions(
      extensionVersion,
      minimumSupportedExtensionVersion,
    ) < 0
  ) {
    return {
      compatible: false,
      status: 426,
      body: {
        error: "This extension version is no longer supported.",
        code: "EXTENSION_UPDATE_REQUIRED",
        installedVersion: extensionVersion,
        currentApiVersion: CURRENT_EXTENSION_API_VERSION,
        supportedApiVersions: SUPPORTED_EXTENSION_API_VERSIONS,
        minimumSupportedExtensionVersion,
        latestPublishedExtensionVersion,
        chromeWebStoreUrl,
      },
    };
  }

  return {
    compatible: true,
    apiVersion,
    extensionVersion,
    legacyClient: !explicitApiVersion && !explicitExtensionVersion,
  };
}
