import { NextRequest, NextResponse } from "next/server";
import type { SafeLogger } from "@/lib/logger";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { rhetoricalPlansEnabled } from "@/modules/grounding/domain/rhetorical-plan";

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
  const {
    GROUNDED_RESPONSE_GATE_ATTESTATION,
    VERCEL_ENV,
    VERCEL_PROJECT_ID,
    VERCEL_URL,
  } = process.env;
  const groundedResponseGate =
    GROUNDED_RESPONSE_GATE_ATTESTATION === "true" &&
    VERCEL_ENV === "preview" &&
    VERCEL_PROJECT_ID &&
    VERCEL_URL
      ? {
          projectId: VERCEL_PROJECT_ID,
          deploymentHost: VERCEL_URL,
          rhetoricalPlans: rhetoricalPlansEnabled(),
          providerWireDebug: process.env.DEBUG === "true",
        }
      : undefined;
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      supabaseOrigin,
      deploymentSha: deploymentSha || null,
      ...(groundedResponseGate ? { groundedResponseGate } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
