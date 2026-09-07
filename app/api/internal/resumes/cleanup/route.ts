import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { cleanupExpiredResumeUploads } from "@/lib/resumes/upload-service";
import { createStatelessServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLEANUP_BATCH_SIZE = 100;
const MAX_CLEANUP_BATCHES = 5;
const MINIMUM_CRON_SECRET_LENGTH = 16;

function hasValidAuthorization(request: NextRequest, secret: string): boolean {
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

export async function GET(request: NextRequest) {
  return withRequestLifecycle("resume-cleanup-api", request, (log) =>
    handleGet(request, log),
  );
}

async function handleGet(request: NextRequest, log: SafeLogger) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < MINIMUM_CRON_SECRET_LENGTH) {
    log.error(
      { errorCode: "RESUME_CLEANUP_NOT_CONFIGURED" },
      "Resume cleanup is not configured",
    );
    return NextResponse.json(
      { success: false, code: "RESUME_CLEANUP_NOT_CONFIGURED" },
      { status: 503 },
    );
  }
  if (!hasValidAuthorization(request, secret)) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const supabase = createStatelessServiceClient();
    let claimed = 0;
    let removed = 0;
    let saturated = false;
    for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch += 1) {
      const result = await cleanupExpiredResumeUploads(
        supabase,
        CLEANUP_BATCH_SIZE,
        log,
      );
      claimed += result.claimed;
      removed += result.removed;
      if (result.claimed < CLEANUP_BATCH_SIZE) break;
      if (batch === MAX_CLEANUP_BATCHES - 1) saturated = true;
    }
    if (saturated) {
      log.warn(
        {
          errorCode: "RESUME_CLEANUP_CAPACITY_SATURATED",
          objectCount: claimed,
        },
        "Resume cleanup reached its invocation capacity",
      );
    }
    return NextResponse.json({ success: true, claimed, removed, saturated });
  } catch {
    log.error({ errorCode: "RESUME_CLEANUP_FAILED" }, "Resume cleanup failed");
    return NextResponse.json(
      { success: false, code: "RESUME_CLEANUP_FAILED" },
      { status: 503 },
    );
  }
}
