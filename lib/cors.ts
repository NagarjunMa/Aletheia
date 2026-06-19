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

  // Only set ACAO for requests with a recognized origin.
  // No wildcard fallback for null-origin requests — chrome extension service workers
  // send origin: chrome-extension://<id> which is matched by ALLOWED_PATTERNS.
  // The old '*' fallback for x-extension-source header was a CORS bypass risk.
  let acao = "";
  if (isAllowedOrigin && origin) acao = origin;

  return {
    "Access-Control-Allow-Origin": acao,
    "Access-Control-Allow-Methods": options.methods ?? "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Extension-Source",
    "Access-Control-Allow-Credentials":
      options.allowCredentials && isAllowedOrigin ? "true" : "",
    Vary: "Origin",
  };
}
