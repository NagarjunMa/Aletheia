import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCorsHeaders } from "@/lib/cors";

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
  const corsHeaders = getCorsHeaders(request, { methods: "GET, OPTIONS" });
  const root = process.cwd();

  const [pkg, manifest] = await Promise.all([
    readJson<PackageJson>(path.join(root, "package.json")),
    readJson<ExtensionManifest>(
      path.join(root, "ascendia-extension", "manifest.json"),
    ),
  ]);

  return NextResponse.json(
    {
      appVersion: pkg.version ?? "unknown",
      extensionVersion: manifest.version ?? "unknown",
      sha:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
        "local",
      builtAt: process.env.VERCEL_GIT_COMMIT_SHA ? undefined : "local",
      chromeWebStoreUrl: process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ?? null,
    },
    {
      headers: {
        ...corsHeaders,
        "Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
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
