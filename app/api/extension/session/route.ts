import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { headers } from "next/headers";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";

const log = createLogger("extension-session");

export const dynamic = "force-dynamic";

// ─── In-memory rate limit for session endpoint ───
// Prevents token enumeration and DoS. 20 requests per minute per IP.
const SESSION_RATE_LIMIT = 20;
const SESSION_WINDOW_MS = 60_000;
const sessionRateMap = new Map<
  string,
  { count: number; windowStart: number }
>();

function checkSessionRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = sessionRateMap.get(ip);
  if (!entry || now - entry.windowStart > SESSION_WINDOW_MS) {
    sessionRateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  if (entry.count > SESSION_RATE_LIMIT) return false;
  return true;
}

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of sessionRateMap) {
    if (now - entry.windowStart > SESSION_WINDOW_MS) sessionRateMap.delete(ip);
  }
}, 5 * 60_000);

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request, { methods: "GET, OPTIONS" }),
  });
}

export async function GET(request: NextRequest) {
  // Call headers() to forcefully opt out of Next.js static generation caching
  headers();

  log.info(
    { origin: request.headers.get("origin") },
    "GET /api/extension/session",
  );
  const corsHeaders = getCorsHeaders(request, { methods: "GET, OPTIONS" });

  // Rate limit by IP — 20 req/min
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkSessionRateLimit(clientIp)) {
    log.warn({ ip: clientIp }, "Session endpoint rate limited");
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: corsHeaders },
    );
  }

  // Session endpoint allows:
  // 1. Requests with a recognized CORS origin (chrome-extension://, localhost, app URL)
  // 2. Null-origin requests with x-extension-source header (service worker fetches)
  // Service worker fetch() with credentials:'include' sends no origin header,
  // but does send the custom header we set.
  const hasAllowedOrigin = !!corsHeaders["Access-Control-Allow-Origin"];
  const isExtensionSource =
    request.headers.get("x-extension-source") === "aletheia-extension";

  if (!hasAllowedOrigin && !isExtensionSource) {
    log.info("Origin not allowed");
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403, headers: corsHeaders },
    );
  }

  try {
    // Log all cookies for debugging (names only, not values)
    const cookieNames = request.cookies.getAll().map((c) => c.name);
    log.debug({ cookies: cookieNames }, "Cookies present");

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      },
    );

    // Step 1: One refresh attempt at most
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    log.info(
      { expiresAt: session?.expires_at, err: sessionError?.message },
      session ? "getSession success" : "getSession failed",
    );

    if (sessionError) {
      if (sessionError.code === "refresh_token_already_used") {
        log.info("refresh_token_already_used on getSession, returning 401");
        return NextResponse.json(
          {
            error: "Session expired. Please log in again.",
            code: "refresh_token_already_used",
          },
          { status: 401, headers: corsHeaders },
        );
      }
      log.info("getSession error, returning 401");
      return NextResponse.json(
        {
          error:
            "Not authenticated. Please log in to the Aletheia web app first.",
        },
        { status: 401, headers: corsHeaders },
      );
    }

    if (!session) {
      log.info("No session, returning 401");
      return NextResponse.json(
        {
          error:
            "Not authenticated. Please log in to the Aletheia web app first.",
        },
        { status: 401, headers: corsHeaders },
      );
    }

    // Step 2: Validate JWT server-side by passing the token explicitly.
    // This calls /auth/v1/user with a Bearer header — no cookie read, no second refresh.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(session.access_token);
    log.info(
      { userId: user?.id?.substring(0, 8), err: userError?.message },
      user ? "getUser success" : "getUser failed",
    );

    if (userError || !user) {
      if (userError?.code === "refresh_token_already_used") {
        return NextResponse.json(
          {
            error: "Session expired. Please log in again.",
            code: "refresh_token_already_used",
          },
          { status: 401, headers: corsHeaders },
        );
      }
      log.info("Not authenticated, returning 401");
      return NextResponse.json(
        {
          error:
            "Not authenticated. Please log in to the Aletheia web app first.",
        },
        { status: 401, headers: corsHeaders },
      );
    }

    log.info({ userId: user.id.substring(0, 8) }, "Returning session");
    return NextResponse.json(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
        },
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      {
        headers: corsHeaders,
      },
    );
  } catch (error) {
    log.error({ err: error }, "Internal error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
