import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders, isApprovedExtensionRequest } from "@/lib/cors";
import { getExtensionContractResponseHeaders } from "@/lib/extension-contract";

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

function sessionUnauthorizedResponse(
  corsHeaders: Record<string, string>,
  code:
    "SESSION_UNAVAILABLE" | "SESSION_REFRESH_REJECTED" | "SESSION_USER_INVALID",
  cause: string,
) {
  return NextResponse.json(
    {
      error: "Your Aletheia session needs to be reconnected.",
      code,
      cause,
    },
    { status: 401, headers: corsHeaders },
  );
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
    headers: {
      ...getCorsHeaders(request, {
        methods: "GET, OPTIONS",
        allowCredentials: true,
      }),
      ...getExtensionContractResponseHeaders(),
    },
  });
}

export async function GET(request: NextRequest) {
  log.info(
    { origin: request.headers.get("origin") },
    "GET /api/extension/session",
  );
  // The SW fetches with credentials: 'include'. Browsers strip the cookies
  // before sending unless the response carries Access-Control-Allow-
  // Credentials: true on BOTH the preflight and the GET. Without this
  // the route sees zero `sb-*-auth-token` cookies and returns 401.
  const corsHeaders = {
    ...getCorsHeaders(request, {
      methods: "GET, OPTIONS",
      allowCredentials: true,
    }),
    ...getExtensionContractResponseHeaders(),
  };

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

  // Session endpoint requires a recognized CORS origin. Extension token
  // exchange is limited further below to the exact configured extension ID.
  const hasAllowedOrigin = !!corsHeaders["Access-Control-Allow-Origin"];

  if (!hasAllowedOrigin) {
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
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
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
        log.info("Stale refresh token rejected on getSession");
        return sessionUnauthorizedResponse(
          corsHeaders,
          "SESSION_REFRESH_REJECTED",
          "REFRESH_TOKEN_ALREADY_USED",
        );
      }
      log.info("getSession error, returning 401");
      return sessionUnauthorizedResponse(
        corsHeaders,
        "SESSION_REFRESH_REJECTED",
        "SESSION_REFRESH_FAILED",
      );
    }

    if (!session) {
      log.info("No session, returning 401");
      return sessionUnauthorizedResponse(
        corsHeaders,
        "SESSION_UNAVAILABLE",
        "NO_ACTIVE_SESSION",
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
        return sessionUnauthorizedResponse(
          corsHeaders,
          "SESSION_REFRESH_REJECTED",
          "REFRESH_TOKEN_ALREADY_USED",
        );
      }
      log.info("Not authenticated, returning 401");
      return sessionUnauthorizedResponse(
        corsHeaders,
        "SESSION_USER_INVALID",
        "USER_VALIDATION_FAILED",
      );
    }

    const isApprovedExtension = isApprovedExtensionRequest(request);

    log.info(
      { userId: user.id.substring(0, 8), isApprovedExtension },
      "Returning session",
    );
    return NextResponse.json(
      {
        ...(isApprovedExtension && {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        }),
        expires_at: session.expires_at,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
        },
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
