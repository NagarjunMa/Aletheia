import type { NextRequest } from "next/server";
import type { StylePatterns } from "@/lib/ai/style-analyzer";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import {
  createBearerAuthClient,
  createBearerServiceClient,
} from "@/lib/supabase/server";
import { getPrimaryResumeText } from "@/lib/resumes/service";
import { refundGenerationCredits } from "@/lib/billing/credits";
import type {
  AuthenticatedExtensionUser,
  AttemptAdmissionResult,
  RateLimitResult,
  ReservedCredit,
} from "@/modules/outreach/domain/extension-generate.types";
import {
  ADMISSION_RPC_TIMEOUT_MS,
  resolveWorkUnitLimit,
} from "@/modules/outreach/domain/generation-admission";

const configuredDailyLimit = Number(process.env.EXTENSION_DAILY_LIMIT ?? 30);
const DAILY_LIMIT =
  Number.isSafeInteger(configuredDailyLimit) &&
  configuredDailyLimit >= 1 &&
  configuredDailyLimit <= 100
    ? configuredDailyLimit
    : 30;
function policyLimit(
  raw: string | undefined,
  fallback: number,
  ceiling: number,
) {
  const value = Number(raw ?? fallback);
  return Number.isSafeInteger(value) && value >= 1 && value <= ceiling
    ? value
    : fallback;
}
const SHORT_ATTEMPT_LIMIT = policyLimit(
  process.env.GENERATION_BURST_LIMIT,
  6,
  100,
);
const WORK_UNIT_LIMIT = resolveWorkUnitLimit(
  process.env.GENERATION_WORK_UNIT_LIMIT,
);
const log = createLogger("extension-generate-repository");

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
  logger: SafeLogger = log,
): Promise<AuthenticatedExtensionUser | null> {
  const complete = startTimedStage(logger, "repository.extension_auth");
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    complete("failure", { errorCode: "AUTH_HEADER_MISSING", status: 401 });
    return null;
  }

  const accessToken = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await getSupabaseAuth().auth.getUser(accessToken);

  if (error || !user) {
    complete("failure", { errorCode: "AUTH_TOKEN_INVALID", status: 401 });
    return null;
  }
  complete("success", { userId: user.id });
  return { userId: user.id, email: user.email ?? "", accessToken };
}

export async function checkGenerationRateLimit(
  userId: string,
  logger: SafeLogger = log,
): Promise<RateLimitResult> {
  const complete = startTimedStage(logger, "repository.rate_limit_rpc", {
    userId,
  });
  let data;
  let error;
  try {
    ({ data, error } = await getSupabaseService().rpc(
      "reserve_generation_daily_slot",
      { p_user_id: userId, p_daily_limit: DAILY_LIMIT },
    ));
  } catch {
    complete("failure", { errorCode: "RATE_LIMIT_RPC_FAILED" });
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: 0,
      unavailable: true,
    };
  }

  if (
    error ||
    !data ||
    data.length === 0 ||
    (data[0]?.allowed && !data[0].reservation_id)
  ) {
    complete("failure", { errorCode: "RATE_LIMIT_RPC_FAILED" });
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: 0,
      unavailable: true,
    };
  }

  const row = data[0];
  complete(row.allowed ? "success" : "failure", {
    ...(row.allowed ? {} : { errorCode: "DAILY_LIMIT_REACHED" }),
    remainingRequests: row.remaining,
  });
  return {
    allowed: row.allowed,
    remainingRequests: row.remaining,
    resetTime: new Date(row.reset_time).getTime(),
    reservationId: row.reservation_id ?? undefined,
  };
}

export async function releaseRateLimitReservation(
  userId: string,
  reservationId: string,
  logger: SafeLogger = log,
): Promise<unknown> {
  const complete = startTimedStage(logger, "repository.rate_limit_release", {
    userId,
  });
  try {
    const result = await getSupabaseService().rpc(
      "release_generation_daily_slot",
      {
        p_user_id: userId,
        p_reservation_id: reservationId,
      },
    );
    if (result.error) throw new Error("Rate limit release failed");
    complete("success");
    return true;
  } catch {
    complete("failure", { errorCode: "RATE_LIMIT_RELEASE_FAILED" });
    return false;
  }
}

/** Admission is charged immediately before a provider call. Its counters are
 * deliberately not refunded if provider output fails or credits are restored. */
export async function startGenerationAttempt(
  userId: string,
  reservationId: string,
  workUnits: number,
  logger: SafeLogger = log,
): Promise<AttemptAdmissionResult> {
  const requestedAt = performance.now();
  const signal = AbortSignal.timeout(ADMISSION_RPC_TIMEOUT_MS);
  const complete = startTimedStage(
    logger,
    "repository.generation_attempt_start",
    {
      userId,
      workUnits,
    },
  );
  let data;
  let error;
  try {
    ({ data, error } = await getSupabaseService()
      .rpc("start_generation_attempt", {
        p_user_id: userId,
        p_reservation_id: reservationId,
        p_work_units: workUnits,
        p_short_limit: SHORT_ATTEMPT_LIMIT,
        p_work_limit: WORK_UNIT_LIMIT,
      })
      .abortSignal(signal));
  } catch {
    complete("failure", { errorCode: "ADMISSION_RPC_FAILED" });
    return { allowed: false, unavailable: true };
  }
  // Cancellation is best effort: reject a late success even when a transport
  // ignores abort, so an expired/replaced lease cannot authorize a model call.
  if (
    signal.aborted ||
    performance.now() - requestedAt >= ADMISSION_RPC_TIMEOUT_MS
  ) {
    complete("failure", { errorCode: "ADMISSION_RPC_TIMEOUT" });
    return { allowed: false, unavailable: true };
  }
  const row = data?.[0];
  if (error || !row) {
    complete("failure", { errorCode: "ADMISSION_RPC_FAILED" });
    return { allowed: false, unavailable: true };
  }
  if (row.allowed && row.attempt_id) {
    complete("success");
    return { allowed: true, attemptId: row.attempt_id };
  }
  if (
    (row.denial_code === "GENERATION_IN_PROGRESS" ||
      row.denial_code === "SHORT_WINDOW_LIMIT_REACHED" ||
      row.denial_code === "WORK_BUDGET_REACHED") &&
    row.retry_time
  ) {
    complete("failure", { errorCode: row.denial_code });
    return {
      allowed: false,
      unavailable: false,
      code: row.denial_code,
      retryTime: new Date(row.retry_time).getTime(),
    };
  }
  complete("failure", { errorCode: "ADMISSION_RPC_INVALID" });
  return { allowed: false, unavailable: true };
}

export async function finishGenerationAttempt(
  userId: string,
  attemptId: string,
  logger: SafeLogger = log,
): Promise<boolean> {
  const complete = startTimedStage(
    logger,
    "repository.generation_attempt_finish",
    {
      userId,
    },
  );
  let data;
  let error;
  try {
    ({ data, error } = await getSupabaseService().rpc(
      "finish_generation_attempt",
      { p_user_id: userId, p_attempt_id: attemptId },
    ));
  } catch {
    complete("failure", { errorCode: "ADMISSION_FINISH_FAILED" });
    return false;
  }
  if (error || data !== true) {
    complete("failure", { errorCode: "ADMISSION_FINISH_FAILED" });
    return false;
  }
  complete("success");
  return true;
}

export async function refundCreditReservation(
  reservedCredit: ReservedCredit,
  reason: string,
  logger: SafeLogger = log,
): Promise<boolean> {
  const complete = startTimedStage(logger, "repository.credit_refund", {
    userId: reservedCredit.userId,
    reason,
  });
  try {
    await refundGenerationCredits(
      getSupabaseService(),
      reservedCredit.userId,
      reservedCredit.reservationId,
      reservedCredit.amount,
      { reason },
    );
    complete("success");
    return true;
  } catch {
    complete("failure", { errorCode: "CREDIT_REFUND_FAILED" });
    // Best-effort refund helper. The calling service owns user-facing error
    // handling and must not have its error path replaced by a refund failure.
    return false;
  }
}

export async function getUserStyleProfile(
  userId: string,
  logger: SafeLogger = log,
): Promise<StylePatterns | undefined> {
  const complete = startTimedStage(logger, "repository.style_profile_read", {
    userId,
  });
  let prefs;
  try {
    const { data, error } = await getSupabaseService()
      .from("user_preferences")
      .select("style_patterns, approved_message_count")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    prefs = data;
  } catch (error) {
    complete("failure", { errorCode: "STYLE_PROFILE_READ_FAILED" });
    throw error;
  }

  if (
    prefs &&
    (prefs.approved_message_count ?? 0) >= 1 &&
    prefs.style_patterns
  ) {
    complete("success", { found: true });
    return prefs.style_patterns as unknown as StylePatterns;
  }

  complete("success", { found: false });
  return undefined;
}

export async function getPrimaryResumeForGeneration(
  userId: string,
  logger: SafeLogger = log,
) {
  const complete = startTimedStage(logger, "repository.primary_resume_read", {
    userId,
  });
  try {
    const resume = await getPrimaryResumeText(
      getSupabaseService(),
      userId,
      logger,
    );
    complete("success", {
      source: resume.source,
      hasText: Boolean(resume.text),
    });
    return resume;
  } catch (error) {
    complete("failure", { errorCode: "PRIMARY_RESUME_READ_FAILED" });
    throw error;
  }
}

export async function getProfileTargetJobDescription(
  userId: string,
  logger: SafeLogger = log,
) {
  const complete = startTimedStage(logger, "repository.target_job_read", {
    userId,
  });
  try {
    const { data: profile, error } = await getSupabaseService()
      .from("profiles")
      .select("target_job_description")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      complete("failure", { errorCode: "TARGET_JOB_DESCRIPTION_READ_FAILED" });
      throw error;
    }
    complete("success", { found: Boolean(profile?.target_job_description) });
    return profile?.target_job_description ?? "";
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) throw error;
    complete("failure", { errorCode: "TARGET_JOB_DESCRIPTION_READ_FAILED" });
    throw error;
  }
}

/** Preserve a server-owned reconciliation marker without storing application data.
 * If the database is unavailable too, the safe log is the operator fallback. */
export async function recordApplicationRefundFailure(
  credit: ReservedCredit,
  reason: string,
  logger: SafeLogger = log,
): Promise<boolean> {
  logger.error(
    {
      event: "billing.refund_pending",
      userId: credit.userId,
      reservationId: credit.reservationId,
      amount: credit.amount,
      errorCode: "CREDIT_REFUND_PENDING",
    },
    "Application refund needs manual reconciliation",
  );
  try {
    const db = getSupabaseService();
    const { data, error } = await db
      .from("credit_ledger")
      .select("metadata")
      .eq("id", credit.reservationId)
      .eq("user_id", credit.userId)
      .eq("reason", "generation_debit")
      .abortSignal(AbortSignal.timeout(3_000))
      .single();
    if (error || !data) throw new Error("Reservation unavailable");
    const metadata =
      data.metadata &&
      typeof data.metadata === "object" &&
      !Array.isArray(data.metadata)
        ? data.metadata
        : {};
    const result = await db
      .from("credit_ledger")
      .update({
        metadata: {
          ...metadata,
          refund_status: "pending_manual_review",
          refund_reason: reason,
        },
      })
      .eq("id", credit.reservationId)
      .eq("user_id", credit.userId)
      .eq("reason", "generation_debit")
      .select("id")
      .abortSignal(AbortSignal.timeout(3_000))
      .single();
    if (result.error || !result.data) throw new Error("Marker unavailable");
    return true;
  } catch {
    logger.error(
      {
        errorCode: "REFUND_RECONCILIATION_RECORD_FAILED",
        userId: credit.userId,
        reservationId: credit.reservationId,
      },
      "Use the refund-pending audit log for reconciliation",
    );
    return false;
  }
}
