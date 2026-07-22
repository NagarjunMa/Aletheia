import type { NextRequest } from "next/server";
import type { StylePatterns } from "@/lib/ai/style-analyzer";
import {
  createBearerAuthClient,
  createBearerServiceClient,
} from "@/lib/supabase/server";
import { getPrimaryResumeText } from "@/lib/resumes/service";
import { refundGenerationCredits } from "@/lib/billing/credits";
import type {
  AuthenticatedExtensionUser,
  RateLimitResult,
  ReservedCredit,
} from "@/modules/outreach/domain/extension-generate.types";

const DAILY_LIMIT = Number(process.env.EXTENSION_DAILY_LIMIT) || 30;

export function getDailyLimit() {
  return DAILY_LIMIT;
}

export function getSupabaseService() {
  return createBearerServiceClient();
}

function getSupabaseAuth() {
  return createBearerAuthClient();
}

export async function authenticateExtensionRequest(
  request: NextRequest,
): Promise<AuthenticatedExtensionUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await getSupabaseAuth().auth.getUser(accessToken);

  if (error || !user) return null;
  return { userId: user.id, email: user.email ?? "" };
}

export async function checkGenerationRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const { data, error } = await getSupabaseService().rpc(
    "check_and_increment_rate_limit",
    {
      p_user_id: userId,
      p_daily_limit: DAILY_LIMIT,
    },
  );

  if (error || !data || data.length === 0) {
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: Date.now() + 60_000,
    };
  }

  const row = data[0];
  return {
    allowed: row.allowed,
    remainingRequests: row.remaining,
    resetTime: new Date(row.reset_time).getTime(),
  };
}

export async function releaseRateLimitReservation(
  userId: string,
): Promise<unknown> {
  try {
    return await getSupabaseService().rpc("release_rate_limit_reservation", {
      p_user_id: userId,
    });
  } catch {
    return null;
  }
}

export async function refundCreditReservation(
  reservedCredit: ReservedCredit,
  reason: string,
): Promise<void> {
  try {
    await refundGenerationCredits(
      getSupabaseService(),
      reservedCredit.userId,
      reservedCredit.reservationId,
      reservedCredit.amount,
      { reason },
    );
  } catch {
    // Best-effort refund helper. The calling service owns user-facing error
    // handling and must not have its error path replaced by a refund failure.
  }
}

export async function getUserStyleProfile(
  userId: string,
): Promise<StylePatterns | undefined> {
  const { data: prefs } = await getSupabaseService()
    .from("user_preferences")
    .select("style_patterns, approved_message_count")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    prefs &&
    (prefs.approved_message_count ?? 0) >= 1 &&
    prefs.style_patterns
  ) {
    return prefs.style_patterns as unknown as StylePatterns;
  }

  return undefined;
}

export async function getPrimaryResumeForGeneration(userId: string) {
  return getPrimaryResumeText(getSupabaseService(), userId);
}

export async function getProfileTargetJobDescription(userId: string) {
  const { data: profile } = await getSupabaseService()
    .from("profiles")
    .select("target_job_description")
    .eq("id", userId)
    .maybeSingle();

  return profile?.target_job_description ?? "";
}
