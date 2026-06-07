// Next.js Middleware for Authentication
// Created: December 7, 2024
// Purpose: Handle authentication, session management, and security

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createLogger } from "@/lib/logger.edge";

const log = createLogger("middleware");

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

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRelated =
    pathname.startsWith("/auth") || pathname.startsWith("/api/extension");

  if (isAuthRelated) {
    log.debug(
      { method: request.method, pathname, search: request.nextUrl.search },
      "Auth-related request",
    );
  }

  // Generate a unique request ID for log correlation across the full request lifecycle.
  // Downstream routes read this via request.headers.get('x-request-id').
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  let response = createForwardedResponse(requestHeaders, requestId);

  const supabase = createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = createForwardedResponse(requestHeaders, requestId);
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = createForwardedResponse(requestHeaders, requestId);
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    },
  );

  // Skip auth for extension session endpoint — it does its own full auth check.
  // Running getUser() here AND in the endpoint creates a token refresh race condition
  // where concurrent requests cause "refresh_token_already_used" errors.
  if (pathname === "/api/extension/session") {
    // Still apply security headers
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return response;
  }

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (isAuthRelated) {
    log.debug({ user: user?.email, errorCode: error?.code }, "getUser result");
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
    return NextResponse.redirect(loginUrl);
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
    log.debug({ user: user?.email }, "Extension login: allowing auth page");
  }

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

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
      ? `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    isDev
      ? "connect-src 'self' http://127.0.0.1:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://api.anthropic.com"
      : "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);

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
