import { NextRequest } from "next/server";

const ALLOWED_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

function buildAllowedPatterns(): RegExp[] {
  const patterns: RegExp[] = [
    /^chrome-extension:\/\//,
    /^https?:\/\/localhost(:\d+)?$/,
  ];
  if (ALLOWED_APP_URL) {
    const escaped = ALLOWED_APP_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push(new RegExp(`^${escaped}$`));
  }
  return patterns;
}

const ALLOWED_PATTERNS = buildAllowedPatterns();

export function getCorsHeaders(
  request: NextRequest,
  options: { allowCredentials?: boolean; methods?: string } = {},
): Record<string, string> {
  const origin = request.headers.get("origin");
  const isAllowedOrigin = origin
    ? ALLOWED_PATTERNS.some((p) => p.test(origin))
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
