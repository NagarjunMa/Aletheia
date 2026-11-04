import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { createStatelessServiceClient } from "@/lib/supabase/server";
import { cleanupQualityFeedback } from "@/lib/ai/quality-retention";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return withRequestLifecycle("quality-cleanup", request, async (log) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 16)
      return NextResponse.json(
        { success: false, code: "QUALITY_CLEANUP_NOT_CONFIGURED" },
        { status: 503 },
      );
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return NextResponse.json(
        { success: false, code: "UNAUTHORIZED" },
        { status: 401 },
      );
    try {
      const result = await cleanupQualityFeedback(
        createStatelessServiceClient(),
      );
      log.info(
        {
          event: "quality.cleanup",
          outcome: result.saturated ? "saturated" : "success",
          removedCount: result.removed,
        },
        "Quality metadata retention",
      );
      return NextResponse.json({ success: true, ...result });
    } catch {
      log.error(
        { errorCode: "QUALITY_CLEANUP_FAILED" },
        "Quality cleanup failed",
      );
      return NextResponse.json(
        { success: false, code: "QUALITY_CLEANUP_FAILED" },
        { status: 503 },
      );
    }
  });
}
