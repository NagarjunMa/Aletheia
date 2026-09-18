// Next.js Proxy for Authentication
// Created: December 7, 2024
// Purpose: Handle authentication, session management, and security

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createLogger, getEdgeCorrelationIds } from "@/lib/logger.edge";

const log = createLogger("proxy");

const AUTH_BYPASS_PATHS = new Set([
  "/api/health",
  "/healthz",
  "/robots.txt",
  "/sitemap.xml",
  "/api/extension/session",
]);

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

function createForwardedResponse(requestHeaders: Headers, requestId: string) {
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

function addBasicSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const startedAt = Date.now();
  const { requestId, operationId } = getEdgeCorrelationIds(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  if (operationId) requestHeaders.set("x-aletheia-operation-id", operationId);
  const isAuthRelated =
    pathname.startsWith("/auth") || pathname.startsWith("/api/extension");

  if (isAuthRelated) {
    log.info(
      {
        event: "request.start",
        requestId,
        operationId,
        method: request.method,
        path: pathname,
      },
      "Request started",
    );
  }

  let response = createForwardedResponse(requestHeaders, requestId);
  if (operationId) response.headers.set("x-aletheia-operation-id", operationId);

  // These routes must be able to respond without auth provider configuration.
  // In CI smoke tests and external uptime checks, /api/health should still work
  // even when Supabase env vars are intentionally absent.
  if (AUTH_BYPASS_PATHS.has(pathname)) {
    addBasicSecurityHeaders(response);
    if (isAuthRelated) {
      log.info(
        {
          event: "request.forwarded",
          requestId,
          operationId,
          outcome: "success",
          durationMs: Date.now() - startedAt,
        },
        "Request forwarded",
      );
    }
    return response;
  }

  // The marketing homepage has no session-dependent content. Do not let stale
  // cookies or an unavailable auth provider turn it into a login redirect.
  // Continue through the shared security-header/CSP path below.
  const supabase =
    pathname === "/"
      ? null
      : createServerClient(
          getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
          getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
          {
            cookies: {
              getAll() {
                return request.cookies.getAll();
              },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => {
                  request.cookies.set(name, value);
                });
                response = createForwardedResponse(requestHeaders, requestId);
                cookiesToSet.forEach(({ name, value, options }) => {
                  response.cookies.set(name, value, options);
                });
              },
            },
          },
        );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
    error,
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };

  if (isAuthRelated) {
    log.info(
      {
        event: "auth.complete",
        requestId,
        operationId,
        outcome: error ? "failure" : "success",
        errorCode: error?.code,
        durationMs: Date.now() - startedAt,
      },
      "Authentication check completed",
    );
  }

  // Handle stale refresh token (caused by concurrent requests racing to refresh)
  if (error?.code === "refresh_token_already_used") {
    log.info(
      { pathname },
      "refresh_token_already_used — clearing stale cookies",
    );

    // Do not redirect API requests to the HTML login page
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json(
        {
          error: "Session expired. Please log in again.",
          code: "refresh_token_already_used",
        },
        { status: 401 },
      );
      res.headers.set("Retry-After", "2");
      res.headers.set("x-request-id", requestId);
      if (operationId) res.headers.set("x-aletheia-operation-id", operationId);
      log.warn(
        {
          event: "request.complete",
          requestId,
          operationId,
          outcome: "failure",
          status: 401,
          errorCode: "SESSION_REFRESH_REJECTED",
          durationMs: Date.now() - startedAt,
        },
        "Request completed",
      );
      return res;
    }

    // For auth and non-API pages: clear stale auth cookies via redirect.
    // We avoid calling signOut() here because the cookie remove() handler
    // reassigns the `response` object on each cookie, which can cause Next.js
    // to lose track of the page route and return 404.
    // Instead, redirect to the same URL — the redirect response clears the
    // stale cookies, and the fresh request will have no auth state.
    const cleanUrl = request.nextUrl.clone();
    if (!pathname.startsWith("/auth")) {
      cleanUrl.pathname = "/auth/login";
      cleanUrl.searchParams.set("redirectTo", pathname);
    }
    const redirectResponse = NextResponse.redirect(cleanUrl);

    // Clear all Supabase auth cookies from the response so the browser
    // drops the stale tokens before the redirect lands
    const cookieNames = request.cookies.getAll().map((c) => c.name);
    for (const name of cookieNames) {
      if (name.startsWith("sb-") && name.includes("auth-token")) {
        redirectResponse.cookies.set(name, "", { maxAge: 0, path: "/" });
      }
    }

    return redirectResponse;
  }

  // Protected routes - redirect to login if not authenticated
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/chat") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/profile");

  if (isProtectedRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("x-request-id", requestId);
    if (operationId)
      redirect.headers.set("x-aletheia-operation-id", operationId);
    return redirect;
  }

  // Redirect authenticated users away from login/register pages (but NOT reset-password or forgot-password)
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/auth/login") ||
    request.nextUrl.pathname.startsWith("/auth/register");

  const isExtensionLogin =
    request.nextUrl.searchParams.get("source") === "extension";
  const isServerAction = request.headers.has("next-action");
  if (isAuthRoute && user && !isExtensionLogin && !isServerAction) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = redirectTo || "/dashboard";
    dashboardUrl.searchParams.delete("redirectTo");
    log.info(
      { redirectTo: dashboardUrl.pathname },
      "Redirecting authenticated user away from auth page",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  if (isAuthRoute && isExtensionLogin) {
    log.debug(
      { event: "auth.extension_login", requestId, operationId },
      "Extension login allowed",
    );
  }

  addBasicSecurityHeaders(response);

  // Nonce-based Content Security Policy.
  // Generate a per-request nonce to replace 'unsafe-inline' for scripts.
  // Next.js reads the nonce from the x-nonce header and applies it to inline scripts.
  // 'strict-dynamic' allows scripts loaded by nonced scripts (Next.js chunks).
  // 'unsafe-inline' kept for style-src only — Tailwind/CSS-in-JS requires it,
  // and style injection is low-risk compared to script injection.
  const nonce = createNonce();
  response.headers.set("x-nonce", nonce);

  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = [
    "default-src 'self'",
    // Dev needs 'unsafe-eval' for Next.js hot reload (react-refresh uses eval).
    // Production uses nonce + strict-dynamic only.
    isDev
      ? `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic' https://widget.openspeechai.com`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://widget.openspeechai.com`,
    "style-src 'self' 'unsafe-inline' https://widget.openspeechai.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://widget.openspeechai.com",
    isDev
      ? "connect-src 'self' http://127.0.0.1:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://widget.openspeechai.com https://openspeechai.com"
      : "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://widget.openspeechai.com https://openspeechai.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);

  if (isAuthRelated) {
    log.info(
      {
        event: "request.forwarded",
        requestId,
        operationId,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      },
      "Request forwarded",
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, icons, and other static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
