import { NextRequest, NextResponse } from "next/server";
import type { SafeLogger } from "@/lib/logger";
import { getCorsHeaders } from "@/lib/cors";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import {
  CURRENT_EXTENSION_API_VERSION,
  getChromeWebStoreUrl,
  getExtensionContractResponseHeaders,
  getMinimumSupportedExtensionVersion,
  getPublishedExtensionVersion,
  SUPPORTED_EXTENSION_API_VERSIONS,
} from "@/lib/extension-contract";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(request, { methods: "GET, OPTIONS" }),
      ...getExtensionContractResponseHeaders(),
    },
  });
}

export async function GET(request: NextRequest) {
  return withRequestLifecycle("extension-config", request, (log) =>
    handleGet(request, log),
  );
}

async function handleGet(request: NextRequest, log: SafeLogger) {
  log.info(
    { hasOrigin: Boolean(request.headers.get("origin")) },
    "GET /api/extension/config",
  );
  return NextResponse.json(
    {
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      api: {
        currentVersion: CURRENT_EXTENSION_API_VERSION,
        supportedVersions: SUPPORTED_EXTENSION_API_VERSIONS,
      },
      extension: {
        publishedVersion: getPublishedExtensionVersion(),
        minimumSupportedVersion: getMinimumSupportedExtensionVersion(),
        chromeWebStoreUrl: getChromeWebStoreUrl(),
      },
    },
    {
      headers: {
        ...getCorsHeaders(request, { methods: "GET, OPTIONS" }),
        ...getExtensionContractResponseHeaders(),
      },
    },
  );
}
