import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database/types";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import {
  RESUME_REJECTION_MESSAGES,
  RESUME_UPLOAD_FAILURE_MESSAGES,
  type FinalizeResumeUploadResponse,
  type ReserveResumeUploadRequest,
  type ReserveResumeUploadResponse,
  type ResumeQualityCode,
  type ResumeRejectionCode,
  type ResumeUploadFailureCode,
} from "./contracts";
import { RESUME_BUCKET, sanitizeResumeFileName } from "./service";
import { validateResumeBytes } from "./validator";

const QUARANTINE_BUCKET = "resume-quarantine";
const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_FINALIZE_RETRIES = 3;
const MAX_CLEANUP_BATCH_SIZE = 500;
const log = createLogger("resume-upload-service");

type Supabase = SupabaseClient<Database>;
type UploadRow = Tables<"resume_uploads">;
type UploadSnapshot = Pick<
  UploadRow,
  | "id"
  | "user_id"
  | "state"
  | "failure_code"
  | "retry_count"
  | "expires_at"
  | "resume_id"
  | "quality_codes"
  | "page_count"
  | "parsed_character_count"
>;
type ClaimedUpload = {
  upload_id: string;
  user_id: string;
  file_name: string;
  declared_mime: string;
  declared_size: number;
  storage_path: string;
  retry_count: number;
};

export type ResumeUploadServiceErrorCode =
  | "ACTIVE_UPLOAD_LIMIT_REACHED"
  | "INVALID_UPLOAD_STATE"
  | "QUARANTINE_OBJECT_MISSING"
  | "RESUME_LIMIT_REACHED"
  | "UPLOAD_EXPIRED"
  | "UPLOAD_NOT_FOUND"
  | "UPLOAD_PROCESSING"
  | "UPLOAD_RATE_LIMIT_REACHED"
  | "UPLOAD_RETRY_LIMIT_REACHED"
  | "UPLOAD_SERVICE_UNAVAILABLE";

export class ResumeUploadServiceError extends Error {
  override readonly name = "ResumeUploadServiceError";
  readonly code: ResumeUploadServiceErrorCode;
  readonly status: number;

  constructor(
    code: ResumeUploadServiceErrorCode,
    status: number,
    message: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function isResumeUploadServiceError(
  error: unknown,
): error is ResumeUploadServiceError {
  return error instanceof Error && error.name === "ResumeUploadServiceError";
}

function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function databaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object" || !("message" in error)) return "";
  return typeof error.message === "string" ? error.message : "";
}

function reservationError(error: unknown): ResumeUploadServiceError {
  const message = databaseErrorMessage(error);
  if (message.includes("active resume upload limit")) {
    return new ResumeUploadServiceError(
      "ACTIVE_UPLOAD_LIMIT_REACHED",
      409,
      "Finish or cancel an existing resume upload before starting another.",
    );
  }
  if (message.includes("hourly resume upload limit")) {
    return new ResumeUploadServiceError(
      "UPLOAD_RATE_LIMIT_REACHED",
      429,
      "Too many resume uploads were started. Please try again later.",
    );
  }
  if (message.includes("resume limit exceeded")) {
    return new ResumeUploadServiceError(
      "RESUME_LIMIT_REACHED",
      409,
      "Delete an existing resume before uploading another.",
    );
  }
  return serviceUnavailable();
}

function serviceUnavailable(): ResumeUploadServiceError {
  return new ResumeUploadServiceError(
    "UPLOAD_SERVICE_UNAVAILABLE",
    503,
    "Resume uploads are temporarily unavailable. Please try again.",
  );
}

function uploadNotFound(): ResumeUploadServiceError {
  return new ResumeUploadServiceError(
    "UPLOAD_NOT_FOUND",
    404,
    "Resume upload not found.",
  );
}

function isExpired(expiresAt: string): boolean {
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function isQualityCode(value: string): value is ResumeQualityCode {
  return [
    "TEXT_TRUNCATED",
    "LOW_TEXT_DENSITY",
    "HIGH_REPETITION",
    "UNUSUAL_CHARACTER_RATIO",
    "SHORT_USABLE_TEXT",
  ].includes(value);
}

function isRejectionCode(value: string): value is ResumeRejectionCode {
  return Object.hasOwn(RESUME_REJECTION_MESSAGES, value);
}

function failureMessage(code: ResumeUploadFailureCode): string {
  return isRejectionCode(code)
    ? RESUME_REJECTION_MESSAGES[code]
    : RESUME_UPLOAD_FAILURE_MESSAGES[code];
}

function failureResponse(
  uploadId: string,
  code: ResumeUploadFailureCode,
  retryable: boolean,
): FinalizeResumeUploadResponse {
  return {
    status: retryable ? "failed" : "rejected",
    uploadId,
    code,
    message: failureMessage(code),
    retryable,
  };
}

function readyResponse(snapshot: UploadSnapshot): FinalizeResumeUploadResponse {
  if (!snapshot.resume_id || snapshot.parsed_character_count === null) {
    throw serviceUnavailable();
  }
  const qualityCodes = snapshot.quality_codes.filter(isQualityCode);
  return {
    status: qualityCodes.length > 0 ? "warning" : "ready",
    uploadId: snapshot.id,
    resumeId: snapshot.resume_id,
    qualityCodes,
    metrics: {
      pageCount: snapshot.page_count,
      characterCount: snapshot.parsed_character_count,
    },
  };
}

function safeReservationFileName(input: ReserveResumeUploadRequest): string {
  const extension = input.declaredMime === "application/pdf" ? "pdf" : "txt";
  const baseName = input.fileName.split(/[\\/]/).pop() ?? "";
  const stem = baseName.slice(0, -(extension.length + 1));
  const safeStem =
    sanitizeResumeFileName(stem).replace(/\.+$/u, "") || "resume";
  return `${safeStem}.${extension}`;
}

async function getOwnedUpload(
  supabase: Supabase,
  uploadId: string,
  userId: string,
): Promise<UploadSnapshot | null> {
  const { data, error } = await supabase
    .from("resume_uploads")
    .select(
      "id,user_id,state,failure_code,retry_count,expires_at,resume_id,quality_codes,page_count,parsed_character_count",
    )
    .eq("id", uploadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw serviceUnavailable();
  return data;
}

export async function reserveResumeUpload(
  supabase: Supabase,
  input: ReserveResumeUploadRequest,
  logger: SafeLogger = log,
): Promise<ReserveResumeUploadResponse> {
  const complete = startTimedStage(logger, "resume_upload.reservation", {
    declaredSize: input.declaredSize,
  });
  try {
    const { data, error } = await supabase.rpc("reserve_resume_upload", {
      p_file_name: safeReservationFileName(input),
      p_declared_mime: input.declaredMime,
      p_declared_size: input.declaredSize,
    });
    if (error) throw reservationError(error);

    const reservation = data?.[0];
    if (
      !reservation ||
      reservation.bucket_id !== QUARANTINE_BUCKET ||
      !reservation.upload_id ||
      !reservation.storage_path ||
      !reservation.expires_at
    ) {
      throw serviceUnavailable();
    }

    complete("success", {
      outcomeCode: "RESUME_UPLOAD_RESERVED",
      declaredSize: input.declaredSize,
    });
    return {
      uploadId: reservation.upload_id,
      bucketId: QUARANTINE_BUCKET,
      storagePath: reservation.storage_path,
      expiresAt: reservation.expires_at,
      uploadOptions: {
        contentType: input.declaredMime,
        upsert: false,
      },
    };
  } catch (error) {
    complete("failure", {
      errorCode: isResumeUploadServiceError(error)
        ? error.code
        : "UPLOAD_SERVICE_UNAVAILABLE",
    });
    throw error;
  }
}

async function markUploaded(
  supabase: Supabase,
  uploadId: string,
  userId: string,
  logger: SafeLogger,
): Promise<void> {
  const complete = startTimedStage(logger, "resume_upload.acknowledgement");
  const { error } = await supabase.rpc("mark_resume_upload_uploaded", {
    p_upload_id: uploadId,
    p_user_id: userId,
  });
  if (!error) {
    complete("success", { outcomeCode: "RESUME_UPLOAD_ACKNOWLEDGED" });
    return;
  }
  if (databaseErrorMessage(error).includes("object not found")) {
    complete("failure", { errorCode: "QUARANTINE_OBJECT_MISSING" });
    throw new ResumeUploadServiceError(
      "QUARANTINE_OBJECT_MISSING",
      409,
      "Upload the reserved resume file before finalizing it.",
    );
  }
  if (databaseErrorCode(error) === "P0002") {
    complete("failure", { errorCode: "UPLOAD_NOT_FOUND" });
    throw uploadNotFound();
  }
  if (databaseErrorCode(error) === "23514") {
    complete("failure", { errorCode: "INVALID_UPLOAD_STATE" });
    throw new ResumeUploadServiceError(
      "INVALID_UPLOAD_STATE",
      409,
      "This resume upload cannot be finalized.",
    );
  }
  complete("failure", { errorCode: "UPLOAD_SERVICE_UNAVAILABLE" });
  throw serviceUnavailable();
}

async function claimUpload(
  supabase: Supabase,
  uploadId: string,
  userId: string,
): Promise<ClaimedUpload> {
  const { data, error } = await supabase.rpc("claim_resume_upload", {
    p_upload_id: uploadId,
    p_user_id: userId,
  });
  if (error || !data?.[0]) {
    if (databaseErrorCode(error) === "P0002") throw uploadNotFound();
    if (databaseErrorCode(error) === "23514") {
      throw new ResumeUploadServiceError(
        "INVALID_UPLOAD_STATE",
        409,
        "This resume upload cannot be finalized.",
      );
    }
    throw serviceUnavailable();
  }
  return data[0];
}

async function rejectUpload(
  supabase: Supabase,
  uploadId: string,
  userId: string,
  failureCode: ResumeUploadFailureCode,
  retryable: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("reject_resume_upload", {
    p_upload_id: uploadId,
    p_user_id: userId,
    p_failure_code: failureCode,
    p_retryable: retryable,
  });
  if (error) throw serviceUnavailable();
}

async function bestEffortRemove(
  supabase: Supabase,
  bucket: string,
  storagePath: string,
  logger: SafeLogger,
  errorCode: string,
): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (!error) return true;
  logger.warn({ errorCode }, "Resume storage cleanup failed");
  return false;
}

async function recordRetryableFailure(
  supabase: Supabase,
  claim: ClaimedUpload,
): Promise<FinalizeResumeUploadResponse & { status: "failed" }> {
  await rejectUpload(
    supabase,
    claim.upload_id,
    claim.user_id,
    "TEMPORARY_PROCESSING_FAILURE",
    true,
  );
  return {
    status: "failed",
    uploadId: claim.upload_id,
    code: "TEMPORARY_PROCESSING_FAILURE",
    message: failureMessage("TEMPORARY_PROCESSING_FAILURE"),
    retryable: true,
  };
}

async function downloadStorageBytes(
  supabase: Supabase,
  bucket: string,
  storagePath: string,
): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(storagePath, {}, { signal: controller.signal });
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function bytesMatch(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function reconcileCompletion(
  supabase: Supabase,
  claim: ClaimedUpload,
): Promise<FinalizeResumeUploadResponse | null> {
  const snapshot = await getOwnedUpload(
    supabase,
    claim.upload_id,
    claim.user_id,
  );
  return snapshot?.state === "ready" ? readyResponse(snapshot) : null;
}

async function compensatePromotion(
  supabase: Supabase,
  claim: ClaimedUpload,
  logger: SafeLogger,
): Promise<boolean> {
  const { error } = await supabase.storage
    .from(RESUME_BUCKET)
    .move(claim.storage_path, claim.storage_path, {
      destinationBucket: QUARANTINE_BUCKET,
    });
  if (!error) return true;

  await bestEffortRemove(
    supabase,
    RESUME_BUCKET,
    claim.storage_path,
    logger,
    "RESUME_PROMOTION_COMPENSATION_FAILED",
  );
  return false;
}

export async function finalizeResumeUpload(
  authenticatedSupabase: Supabase,
  createServiceClient: () => Supabase,
  userId: string,
  uploadId: string,
  logger: SafeLogger = log,
): Promise<FinalizeResumeUploadResponse> {
  const complete = startTimedStage(logger, "resume_upload.finalize", {
    userId: userId.substring(0, 12),
  });
  let terminalRecorded = false;
  const finish = (
    outcome: "success" | "failure",
    fields: Parameters<ReturnType<typeof startTimedStage>>[1] = {},
  ) => {
    if (!terminalRecorded) {
      terminalRecorded = true;
      complete(outcome, fields);
    }
  };

  try {
    const snapshot = await getOwnedUpload(
      authenticatedSupabase,
      uploadId,
      userId,
    );
    if (!snapshot) throw uploadNotFound();
    if (snapshot.state === "ready") {
      const response = readyResponse(snapshot);
      finish("success", { outcomeCode: "UPLOAD_ALREADY_READY" });
      return response;
    }
    if (snapshot.state === "rejected") {
      const code =
        snapshot.failure_code && isRejectionCode(snapshot.failure_code)
          ? snapshot.failure_code
          : snapshot.failure_code === "DUPLICATE_RESUME" ||
              snapshot.failure_code === "PERSISTENCE_FAILURE"
            ? snapshot.failure_code
            : "PERSISTENCE_FAILURE";
      finish("failure", { errorCode: code });
      return failureResponse(uploadId, code, false);
    }
    if (snapshot.state === "validating") {
      throw new ResumeUploadServiceError(
        "UPLOAD_PROCESSING",
        409,
        "This resume upload is already being processed.",
      );
    }
    if (snapshot.state === "expired" || isExpired(snapshot.expires_at)) {
      throw new ResumeUploadServiceError(
        "UPLOAD_EXPIRED",
        410,
        "This resume upload reservation has expired.",
      );
    }
    if (snapshot.state === "canceled") {
      throw new ResumeUploadServiceError(
        "INVALID_UPLOAD_STATE",
        409,
        "This resume upload was canceled.",
      );
    }
    const shouldMarkUploaded = snapshot.state === "reserved";
    if (snapshot.state === "failed") {
      if (
        snapshot.failure_code !== "TEMPORARY_PROCESSING_FAILURE" ||
        snapshot.retry_count >= MAX_FINALIZE_RETRIES
      ) {
        throw new ResumeUploadServiceError(
          "UPLOAD_RETRY_LIMIT_REACHED",
          409,
          "This resume upload cannot be retried. Please upload it again.",
        );
      }
    } else if (!shouldMarkUploaded && snapshot.state !== "uploaded") {
      throw new ResumeUploadServiceError(
        "INVALID_UPLOAD_STATE",
        409,
        "This resume upload cannot be finalized.",
      );
    }

    const supabase = createServiceClient();
    if (shouldMarkUploaded) {
      await markUploaded(supabase, uploadId, userId, logger);
    }
    const claim = await claimUpload(supabase, uploadId, userId);
    let sourceBucket = QUARANTINE_BUCKET;
    let bytes = await downloadStorageBytes(
      supabase,
      QUARANTINE_BUCKET,
      claim.storage_path,
    );
    if (!bytes && snapshot.state === "failed") {
      bytes = await downloadStorageBytes(
        supabase,
        RESUME_BUCKET,
        claim.storage_path,
      );
      if (bytes) sourceBucket = RESUME_BUCKET;
    }
    if (!bytes) {
      const response = await recordRetryableFailure(supabase, claim);
      finish("failure", { errorCode: response.code });
      return response;
    }

    let validation;
    const completeValidation = startTimedStage(
      logger,
      "resume_upload.validation",
      { byteCount: bytes.byteLength },
    );
    try {
      validation = await validateResumeBytes(
        {
          bytes,
          fileName: claim.file_name,
          declaredMime: claim.declared_mime,
          declaredSize: claim.declared_size,
        },
        { logger },
      );
      completeValidation(
        validation.status === "rejected" ? "failure" : "success",
        validation.status === "rejected"
          ? { errorCode: validation.code }
          : {
              outcomeCode:
                validation.status === "warning"
                  ? "RESUME_VALID_WITH_WARNINGS"
                  : "RESUME_VALID",
              pageCount: validation.metrics.pageCount,
              characterCount: validation.metrics.characterCount,
              qualityCodeCount: validation.qualityCodes.length,
            },
      );
    } catch {
      completeValidation("failure", {
        errorCode: "TEMPORARY_PROCESSING_FAILURE",
      });
      const response = await recordRetryableFailure(supabase, claim);
      finish("failure", { errorCode: response.code });
      return response;
    }
    if (validation.status === "rejected") {
      const completeRejection = startTimedStage(
        logger,
        "resume_upload.rejection",
      );
      try {
        await rejectUpload(
          supabase,
          claim.upload_id,
          claim.user_id,
          validation.code,
          false,
        );
        const removed = await bestEffortRemove(
          supabase,
          sourceBucket,
          claim.storage_path,
          logger,
          "REJECTED_RESUME_CLEANUP_FAILED",
        );
        completeRejection("failure", {
          errorCode: validation.code,
          cleanupSucceeded: removed,
        });
      } catch (error) {
        completeRejection("failure", {
          errorCode: "UPLOAD_SERVICE_UNAVAILABLE",
        });
        throw error;
      }
      finish("failure", { errorCode: validation.code });
      return failureResponse(uploadId, validation.code, false);
    }

    const completePromotion = startTimedStage(
      logger,
      "resume_upload.promotion",
    );
    let promotionResponseReconciled = sourceBucket === RESUME_BUCKET;
    const { error: moveError } = promotionResponseReconciled
      ? { error: null }
      : await supabase.storage
          .from(QUARANTINE_BUCKET)
          .move(claim.storage_path, claim.storage_path, {
            destinationBucket: RESUME_BUCKET,
          });
    if (moveError) {
      const promotedBytes = await downloadStorageBytes(
        supabase,
        RESUME_BUCKET,
        claim.storage_path,
      );
      if (!promotedBytes) {
        completePromotion("failure", {
          errorCode: "TEMPORARY_PROCESSING_FAILURE",
        });
        const response = await recordRetryableFailure(supabase, claim);
        finish("failure", { errorCode: response.code });
        return response;
      }
      if (!bytesMatch(bytes, promotedBytes)) {
        completePromotion("failure", { errorCode: "PERSISTENCE_FAILURE" });
        await bestEffortRemove(
          supabase,
          QUARANTINE_BUCKET,
          claim.storage_path,
          logger,
          "MISMATCHED_QUARANTINE_RESUME_CLEANUP_FAILED",
        );
        await bestEffortRemove(
          supabase,
          RESUME_BUCKET,
          claim.storage_path,
          logger,
          "MISMATCHED_PROMOTED_RESUME_CLEANUP_FAILED",
        );
        await rejectUpload(
          supabase,
          claim.upload_id,
          claim.user_id,
          "PERSISTENCE_FAILURE",
          false,
        );
        finish("failure", { errorCode: "PERSISTENCE_FAILURE" });
        return failureResponse(uploadId, "PERSISTENCE_FAILURE", false);
      }
      promotionResponseReconciled = true;
      completePromotion("success", {
        outcomeCode: "RESUME_PROMOTION_RESPONSE_RECONCILED",
      });
      logger.warn(
        { errorCode: "RESUME_PROMOTION_RESPONSE_RECONCILED" },
        "Resume promotion response reconciled",
      );
    } else {
      completePromotion("success", {
        outcomeCode:
          sourceBucket === RESUME_BUCKET
            ? "RESUME_ALREADY_PROMOTED"
            : "RESUME_PROMOTED",
      });
    }

    const completionArgs = {
      p_upload_id: claim.upload_id,
      p_user_id: claim.user_id,
      p_label: sanitizeResumeFileName(claim.file_name).slice(0, 120),
      p_detected_mime: validation.detectedMime,
      p_detected_size: validation.metrics.byteCount,
      p_parsed_text: validation.parsedText,
      p_content_sha256: validation.contentSha256,
      p_page_count: validation.metrics.pageCount,
      p_quality_codes: validation.qualityCodes,
    };
    let completion = await supabase.rpc(
      "complete_resume_upload",
      completionArgs,
    );
    if (
      (completion.error || !completion.data?.[0]) &&
      databaseErrorCode(completion.error) !== "23505"
    ) {
      completion = await supabase.rpc("complete_resume_upload", completionArgs);
    }

    const completed = completion.data?.[0];
    if (completion.error || !completed?.completed_resume_id) {
      const reconciled = await reconcileCompletion(supabase, claim);
      if (reconciled) {
        if (promotionResponseReconciled) {
          await bestEffortRemove(
            supabase,
            QUARANTINE_BUCKET,
            claim.storage_path,
            logger,
            "RECONCILED_QUARANTINE_RESUME_CLEANUP_FAILED",
          );
        }
        finish("success", { outcomeCode: "UPLOAD_COMPLETION_RECONCILED" });
        return reconciled;
      }

      if (databaseErrorCode(completion.error) === "23505") {
        await bestEffortRemove(
          supabase,
          RESUME_BUCKET,
          claim.storage_path,
          logger,
          "DUPLICATE_RESUME_CLEANUP_FAILED",
        );
        await rejectUpload(
          supabase,
          claim.upload_id,
          claim.user_id,
          "DUPLICATE_RESUME",
          false,
        );
        if (promotionResponseReconciled) {
          await bestEffortRemove(
            supabase,
            QUARANTINE_BUCKET,
            claim.storage_path,
            logger,
            "DUPLICATE_QUARANTINE_RESUME_CLEANUP_FAILED",
          );
        }
        finish("failure", { errorCode: "DUPLICATE_RESUME" });
        return failureResponse(uploadId, "DUPLICATE_RESUME", false);
      }

      const restored = await compensatePromotion(supabase, claim, logger);
      const code: ResumeUploadFailureCode = restored
        ? "TEMPORARY_PROCESSING_FAILURE"
        : "PERSISTENCE_FAILURE";
      await rejectUpload(
        supabase,
        claim.upload_id,
        claim.user_id,
        code,
        restored,
      );
      finish("failure", { errorCode: code });
      return failureResponse(uploadId, code, restored);
    }

    if (promotionResponseReconciled) {
      await bestEffortRemove(
        supabase,
        QUARANTINE_BUCKET,
        claim.storage_path,
        logger,
        "RECONCILED_QUARANTINE_RESUME_CLEANUP_FAILED",
      );
    }
    finish("success", {
      outcomeCode:
        validation.status === "warning" ? "RESUME_WARNING" : "RESUME_READY",
      pageCount: validation.metrics.pageCount,
      characterCount: validation.metrics.characterCount,
      qualityCodeCount: validation.qualityCodes.length,
    });
    return {
      status: validation.status,
      uploadId,
      resumeId: completed.completed_resume_id,
      qualityCodes: validation.qualityCodes,
      metrics: {
        pageCount: validation.metrics.pageCount,
        characterCount: validation.metrics.characterCount,
      },
    };
  } catch (error) {
    finish("failure", {
      errorCode: isResumeUploadServiceError(error)
        ? error.code
        : "UPLOAD_SERVICE_UNAVAILABLE",
    });
    throw error;
  }
}

export async function cancelResumeUpload(
  supabase: Supabase,
  uploadId: string,
  createServiceClient: () => Supabase,
  logger: SafeLogger = log,
): Promise<{ status: "canceled"; uploadId: string }> {
  const { data, error } = await supabase.rpc("cancel_resume_upload", {
    p_upload_id: uploadId,
  });
  if (error || !data?.[0]) {
    if (databaseErrorCode(error) === "P0002") throw uploadNotFound();
    if (databaseErrorCode(error) === "23514") {
      throw new ResumeUploadServiceError(
        "INVALID_UPLOAD_STATE",
        409,
        "This resume upload cannot be canceled.",
      );
    }
    throw serviceUnavailable();
  }

  const serviceSupabase = createServiceClient();
  await bestEffortRemove(
    serviceSupabase,
    QUARANTINE_BUCKET,
    data[0].storage_path,
    logger,
    "CANCELED_RESUME_CLEANUP_FAILED",
  );
  return { status: "canceled", uploadId };
}

type CleanupCandidate = {
  upload_id: string;
  user_id: string;
  storage_path: string;
};

export async function cleanupExpiredResumeUploads(
  supabase: Supabase,
  batchSize = 100,
  logger: SafeLogger = log,
): Promise<{ claimed: number; removed: number }> {
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_CLEANUP_BATCH_SIZE
  ) {
    throw new Error("Invalid resume cleanup batch size.");
  }

  const complete = startTimedStage(logger, "resume_upload.cleanup", {
    batchSize,
  });

  const { data, error } = await supabase.rpc("expire_resume_uploads", {
    p_limit: batchSize,
  });
  if (error) {
    logger.error(
      { errorCode: "RESUME_CLEANUP_CLAIM_FAILED" },
      "Resume cleanup claim failed",
    );
    complete("failure", { errorCode: "RESUME_CLEANUP_CLAIM_FAILED" });
    throw new Error("Resume cleanup is temporarily unavailable.");
  }

  const candidates = (data ?? []) as CleanupCandidate[];
  if (candidates.length === 0) {
    complete("success", { claimedCount: 0, removedCount: 0 });
    return { claimed: 0, removed: 0 };
  }

  const paths = candidates.map((candidate) => candidate.storage_path);
  const { error: removalError } = await supabase.storage
    .from(QUARANTINE_BUCKET)
    .remove(paths);
  if (removalError) {
    logger.warn(
      {
        errorCode: "RESUME_QUARANTINE_BATCH_CLEANUP_FAILED",
        objectCount: candidates.length,
      },
      "Resume quarantine cleanup failed",
    );
    complete("failure", {
      errorCode: "RESUME_QUARANTINE_BATCH_CLEANUP_FAILED",
      claimedCount: candidates.length,
    });
    throw new Error("Resume cleanup is temporarily unavailable.");
  }

  const uploadIds = candidates.map((candidate) => candidate.upload_id);
  const { data: markedCount, error: markError } = await supabase.rpc(
    "mark_resume_uploads_cleaned",
    { p_upload_ids: uploadIds },
  );
  if (markError || markedCount !== uploadIds.length) {
    logger.warn(
      {
        errorCode: "RESUME_CLEANUP_COMPLETION_FAILED",
        objectCount: candidates.length,
      },
      "Resume cleanup completion recording failed",
    );
    complete("failure", {
      errorCode: "RESUME_CLEANUP_COMPLETION_FAILED",
      claimedCount: candidates.length,
    });
    throw new Error("Resume cleanup is temporarily unavailable.");
  }

  logger.info(
    {
      outcomeCode: "RESUME_CLEANUP_COMPLETE",
      objectCount: candidates.length,
    },
    "Resume quarantine cleanup completed",
  );
  complete("success", {
    claimedCount: candidates.length,
    removedCount: candidates.length,
  });
  return { claimed: candidates.length, removed: candidates.length };
}
