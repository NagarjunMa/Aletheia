import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

export const dynamic = "force-dynamic";

type PackageJson = {
  version?: string;
};

type ExtensionManifest = {
  version?: string;
};

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function GET(request: NextRequest) {
  return withRequestLifecycle("extension-version", request, () =>
    handleGet(request),
  );
}

async function handleGet(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request, { methods: "GET, OPTIONS" });
  const root = process.cwd();

  const [pkg, manifest] = await Promise.all([
    readJson<PackageJson>(path.join(root, "package.json")),
    readJson<ExtensionManifest>(
      path.join(root, "ascendia-extension", "manifest.json"),
    ),
  ]);
  const sourceExtensionVersion = manifest.version ?? "unknown";
  const publishedExtensionVersion = getPublishedExtensionVersion();
  const minimumSupportedExtensionVersion =
    getMinimumSupportedExtensionVersion();
  const chromeWebStoreUrl = getChromeWebStoreUrl();
  const deploymentSha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    "";

  return NextResponse.json(
    {
      appVersion: pkg.version ?? "unknown",
      extensionVersion: sourceExtensionVersion,
      sha: deploymentSha ? deploymentSha.slice(0, 12) : "local",
      builtAt: deploymentSha ? undefined : "local",
      chromeWebStoreUrl,
      api: {
        currentVersion: CURRENT_EXTENSION_API_VERSION,
        supportedVersions: SUPPORTED_EXTENSION_API_VERSIONS,
      },
      extension: {
        latestSourceVersion: sourceExtensionVersion,
        publishedVersion: publishedExtensionVersion,
        minimumSupportedVersion: minimumSupportedExtensionVersion,
        chromeWebStoreUrl,
      },
    },
    {
      headers: {
        ...corsHeaders,
        ...getExtensionContractResponseHeaders(),
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request, { methods: "GET, OPTIONS" }),
  });
}
