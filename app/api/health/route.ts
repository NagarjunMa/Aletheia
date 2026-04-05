import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("health");

export async function GET() {
  log.debug("Health check");
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
