import { NextRequest, NextResponse } from "next/server";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRequestLifecycle("health", request, handleGet);
}

async function handleGet(log: SafeLogger) {
  log.debug("Health check");
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
