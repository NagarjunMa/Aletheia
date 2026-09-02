import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SafeLogger } from "@/lib/logger";
import {
  analyzeStyle,
  mergeStylePatterns,
  type StylePatterns,
} from "@/lib/ai/style-analyzer";
import {
  createBearerAuthClient,
  createBearerServiceClient,
} from "@/lib/supabase/server";
import { getCorsHeaders } from "@/lib/cors";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import {
  evaluateExtensionContract,
  getExtensionContractResponseHeaders,
} from "@/lib/extension-contract";
import { feedbackSchema } from "./schema";

// Lazy factory functions — avoid module-level instantiation at build time
function getSupabaseService() {
  return createBearerServiceClient();
}

function getSupabaseAuth() {
  return createBearerAuthClient();
}

// ─── Auth helper (duplicated from generate/route.ts) ───

async function authenticateRequest(
  request: NextRequest,
  log: SafeLogger,
): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    log.info("No Bearer token in Authorization header");
    return null;
  }

  const accessToken = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await getSupabaseAuth().auth.getUser(accessToken);

  if (error || !user) {
    log.info(
      { errorCode: "EXTENSION_TOKEN_INVALID" },
      "Token validation failed",
    );
    return null;
  }

  return { userId: user.id, email: user.email || "" };
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  return withRequestLifecycle("extension-feedback", request, (log) =>
    handlePost(request, log),
  );
}

async function handlePost(request: NextRequest, log: SafeLogger) {
  const corsHeaders = {
    ...getCorsHeaders(request, {
      allowCredentials: true,
      methods: "GET, POST, OPTIONS",
    }),
    ...getExtensionContractResponseHeaders(),
  };

  try {
    const contract = evaluateExtensionContract(request.headers);
    if (!contract.compatible) {
      return NextResponse.json(contract.body, {
        status: contract.status,
        headers: corsHeaders,
      });
    }

    // Auth
    const authResult = await authenticateRequest(request, log);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid Bearer token required" },
        { status: 401, headers: corsHeaders },
      );
    }

    // Parse
    const body = await request.json();
    const {
      message,
      approved,
      category,
      subjectLine,
      rejectionReason,
      evalMetadata,
    } = feedbackSchema.parse(body);

    log.info(
      {
        userId: authResult.userId.substring(0, 12),
        approved,
        category,
        hasRejectionReason: Boolean(rejectionReason),
        promptVersion: evalMetadata?.promptVersion,
        apiVersion: contract.apiVersion,
        extensionVersion: contract.extensionVersion,
        legacyExtensionClient: contract.legacyClient,
      },
      "Feedback received",
    );

    // Persist eval event into user_feedback (synchronous — eval signal must
    // not be lost if fire-and-forget worker dies after response).
    const { error: insertErr } = await getSupabaseService()
      .from("user_feedback")
      .insert({
        user_id: authResult.userId,
        feedback_type: approved ? "approved" : "rejected",
        rating: approved ? 5 : 1,
        comment: rejectionReason ?? null,
        metadata: {
          ...(evalMetadata ?? {}),
          category,
          message_length: message.length,
          has_subject: !!subjectLine,
          extension_version: contract.extensionVersion,
          extension_api_version: contract.apiVersion,
          legacy_extension_client: contract.legacyClient,
        },
      });

    if (insertErr) {
      log.error(
        { errorCode: "FEEDBACK_PERSIST_FAILED" },
        "Failed to persist user_feedback row — eval signal lost",
      );
    }

    // Return 200 immediately — style analysis runs fire-and-forget
    const response = NextResponse.json(
      { success: true },
      { headers: corsHeaders },
    );

    // Fire-and-forget async processing
    processStyleFeedback(
      authResult.userId,
      message,
      approved,
      category,
      log,
      subjectLine,
    ).catch(() => {
      log.error(
        { errorCode: "STYLE_FEEDBACK_BACKGROUND_FAILED" },
        "Background style processing failed",
      );
    });

    return response;
  } catch (error) {
    log.error(
      { errorCode: "EXTENSION_FEEDBACK_FAILED" },
      "Feedback endpoint error",
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}

// ─── Background style processing ───

async function processStyleFeedback(
  userId: string,
  message: string,
  approved: boolean,
  category: string,
  log: SafeLogger,
  subjectLine?: string,
) {
  // Fetch existing preferences
  const { data: prefs, error: fetchErr } = await getSupabaseService()
    .from("user_preferences")
    .select("style_patterns, approved_message_count, rejected_message_count")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    log.error(
      { errorCode: "STYLE_PREFERENCES_READ_FAILED" },
      "Failed to fetch user_preferences",
    );
    return;
  }

  if (approved) {
    // Analyze style from approved message
    const fullText = subjectLine ? `${subjectLine}\n\n${message}` : message;
    const incoming = analyzeStyle(fullText);

    const existingPatterns = (prefs?.style_patterns ??
      null) as StylePatterns | null;
    const merged = existingPatterns
      ? mergeStylePatterns(existingPatterns, incoming)
      : incoming;

    // Use atomic increment via RPC to avoid read-then-write race condition.
    // Fallback to upsert if RPC unavailable (non-critical background op).
    const supabase = getSupabaseService();
    const { error: rpcErr } = await supabase.rpc("increment_approved_count", {
      p_user_id: userId,
      p_style_patterns: merged as unknown as Record<string, unknown>,
    });

    if (rpcErr) {
      // Fallback: non-atomic upsert (acceptable for style data — eventual consistency)
      log.warn(
        { errorCode: "STYLE_APPROVED_INCREMENT_FAILED" },
        "Atomic increment RPC unavailable, falling back to upsert",
      );
      const currentCount = (prefs?.approved_message_count ?? 0) as number;
      const { error: upsertErr } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: userId,
            style_patterns: merged as unknown as Record<string, unknown>,
            approved_message_count: currentCount + 1,
          },
          { onConflict: "user_id" },
        );

      if (upsertErr) {
        log.error(
          { errorCode: "STYLE_PATTERNS_UPSERT_FAILED" },
          "Failed to upsert style_patterns",
        );
      } else {
        log.info(
          { userId: userId.substring(0, 8), approvedCount: currentCount + 1 },
          "Style patterns updated (fallback)",
        );
      }
    } else {
      log.info(
        { userId: userId.substring(0, 8) },
        "Style patterns updated (atomic)",
      );
    }
  } else {
    // Rejected: atomic increment via RPC with upsert fallback
    const supabase = getSupabaseService();
    const { error: rpcErr } = await supabase.rpc("increment_rejected_count", {
      p_user_id: userId,
    });

    if (rpcErr) {
      log.warn(
        { errorCode: "STYLE_REJECTED_INCREMENT_FAILED" },
        "Atomic increment RPC unavailable, falling back to upsert",
      );
      const currentCount = (prefs?.rejected_message_count ?? 0) as number;
      const { error: upsertErr } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: userId,
            rejected_message_count: currentCount + 1,
          },
          { onConflict: "user_id" },
        );

      if (upsertErr) {
        log.error(
          { errorCode: "STYLE_REJECTED_UPSERT_FAILED" },
          "Failed to increment rejected_message_count",
        );
      }
    }
  }
}

// ─── OPTIONS handler for CORS preflight ───

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(request, {
        allowCredentials: true,
        methods: "GET, POST, OPTIONS",
      }),
      ...getExtensionContractResponseHeaders(),
      "Access-Control-Max-Age": "86400",
    },
  });
}
