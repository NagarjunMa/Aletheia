import { NextRequest, NextResponse } from "next/server";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRequestLifecycle("health", request, handleGet);
}

async function handleGet(log: SafeLogger) {
  log.debug("Health check");
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  let supabaseOrigin: string | null = null;
  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configuredSupabaseUrl) {
    try {
      supabaseOrigin = new URL(configuredSupabaseUrl).origin;
    } catch {
      // Startup validation owns configuration errors; health reports null.
    }
  }
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    supabaseOrigin,
    deploymentSha: deploymentSha || null,
  });
}
