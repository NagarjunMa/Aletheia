import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";

const log = createLogger("extension-version");

export const dynamic = "force-dynamic";

// Returns the version metadata for the downloadable extension zip.
// Generated at build time by scripts/build-extension-zip.mjs.
// Used by the landing page + dashboard to surface "v1.0.0 · 78ca5a7" and
// to cache-bust the /ascendia-extension.zip download link.
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, { methods: "GET, OPTIONS" });

  try {
    const metaPath = path.join(
      process.cwd(),
      "public",
      "ascendia-extension.version.json",
    );
    const raw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(raw);

    return NextResponse.json(meta, {
      headers: {
        ...corsHeaders,
        // Cache for 5 min at edge; clients re-fetch hourly via stale-while-revalidate
        "Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "version metadata missing — extension zip may not be built yet",
    );
    return NextResponse.json(
      { error: "Extension version metadata unavailable" },
      { status: 503, headers: corsHeaders },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request, { methods: "GET, OPTIONS" }),
  });
}
