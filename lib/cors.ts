import { NextRequest } from "next/server";

function normalizeExtensionOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const origin = trimmed.startsWith("chrome-extension://")
    ? trimmed
    : `chrome-extension://${trimmed}`;

  return origin.replace(/\/+$/, "");
}

export function getAllowedExtensionOrigins(): string[] {
  const raw =
    process.env.CHROME_EXTENSION_IDS ?? process.env.CHROME_EXTENSION_ID ?? "";

  return raw
    .split(",")
    .map(normalizeExtensionOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

export function isAllowedExtensionOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return getAllowedExtensionOrigins().includes(origin.replace(/\/+$/, ""));
}

export function isApprovedExtensionRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) return isAllowedExtensionOrigin(origin);
  // host_permissions-covered fetches from the extension's service worker
  // never carry an Origin header — Chrome exempts them from CORS entirely.
  // X-Extension-Source is the only identity signal available for those.
  return request.headers.get("x-extension-source") === "aletheia-extension";
}

function buildAllowedPatterns(): RegExp[] {
  const patterns: RegExp[] = [];
  const deploymentEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  const allowLocalhost =
    deploymentEnv !== "production" ||
    process.env.ALLOW_LOCALHOST_CORS === "true";

  if (allowLocalhost) {
    patterns.push(/^https?:\/\/localhost(:\d+)?$/);
  }

  const allowedAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (allowedAppUrl) {
    let shouldAllowAppUrl = true;
    try {
      const parsedAppUrl = new URL(allowedAppUrl);
      shouldAllowAppUrl =
        parsedAppUrl.hostname !== "localhost" || allowLocalhost;
    } catch {
      shouldAllowAppUrl = false;
    }

    if (shouldAllowAppUrl) {
      const escaped = allowedAppUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      patterns.push(new RegExp(`^${escaped}$`));
    }
  }
  for (const extensionOrigin of getAllowedExtensionOrigins()) {
    const escaped = extensionOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push(new RegExp(`^${escaped}$`));
  }
  return patterns;
}

export function getCorsHeaders(
  request: NextRequest,
  options: { allowCredentials?: boolean; methods?: string } = {},
): Record<string, string> {
  const origin = request.headers.get("origin");
  const isAllowedOrigin = origin
    ? buildAllowedPatterns().some((p) => p.test(origin))
    : false;

  // host_permissions-covered fetches from the extension's service worker
  // never carry an Origin header — Chrome exempts them from CORS entirely.
  // Treat a verified null-origin extension request as allowed too, echoing
  // a real configured extension origin — never a '*' wildcard.
  const isNullOriginExtension = !origin && isApprovedExtensionRequest(request);
  const treatAsAllowed = isAllowedOrigin || isNullOriginExtension;

  let acao = "";
  if (isAllowedOrigin && origin) {
    acao = origin;
  } else if (isNullOriginExtension) {
    acao = getAllowedExtensionOrigins()[0] ?? "";
  }

  return {
    "Access-Control-Allow-Origin": acao,
    "Access-Control-Allow-Methods": options.methods ?? "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Extension-Source, X-Aletheia-API-Version, X-Aletheia-Extension-Version, X-Aletheia-Operation-Id, X-Request-Id",
    "Access-Control-Expose-Headers":
      "X-Aletheia-API-Version, X-Aletheia-Minimum-Extension-Version, X-Aletheia-Operation-Id, X-Request-Id",
    "Access-Control-Allow-Credentials":
      options.allowCredentials && treatAsAllowed && acao ? "true" : "",
    Vary: "Origin",
  };
}
