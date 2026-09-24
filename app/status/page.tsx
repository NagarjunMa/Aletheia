import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ShaderBackground from "@/components/ShaderBackground";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status — Aletheia",
  description: "Current build version, commit SHA, and last deploy time.",
  alternates: {
    canonical: "/status",
  },
};

type VersionPayload = {
  appVersion: string;
  extensionVersion: string;
  sha: string;
  builtAt?: string;
  chromeWebStoreUrl: string | null;
  api: {
    currentVersion: string;
    supportedVersions: string[];
  };
  extension: {
    latestSourceVersion: string;
    publishedVersion: string;
    minimumSupportedVersion: string;
    chromeWebStoreUrl: string | null;
  };
};

async function getVersion(): Promise<VersionPayload | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/extension/version`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as VersionPayload;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const version = await getVersion();

  return (
    <div className="landing">
      <ShaderBackground />
      <Navbar />
      <main className="relative mx-auto min-h-screen max-w-3xl px-6 pb-24 pt-32">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--l-text-dim)" }}
          >
            ← Back to home
          </Link>
          <h1
            className="mt-8 mb-6"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "clamp(3rem, 6vw, 4.5rem)",
              fontWeight: 400,
            }}
          >
            Status
          </h1>
          {version ? (
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt style={{ color: "var(--l-text-dim)" }}>App version</dt>
              <dd>{version.appVersion}</dd>
              <dt style={{ color: "var(--l-text-dim)" }}>Extension</dt>
              <dd>
                Source {version.extension.latestSourceVersion} · Store{" "}
                {version.extension.publishedVersion}
              </dd>
              <dt style={{ color: "var(--l-text-dim)" }}>Minimum extension</dt>
              <dd>{version.extension.minimumSupportedVersion}</dd>
              <dt style={{ color: "var(--l-text-dim)" }}>API contract</dt>
              <dd>v{version.api.currentVersion}</dd>
              <dt style={{ color: "var(--l-text-dim)" }}>Commit</dt>
              <dd className="font-mono">{version.sha.slice(0, 12)}</dd>
              <dt style={{ color: "var(--l-text-dim)" }}>Install source</dt>
              <dd>
                {version.chromeWebStoreUrl ? (
                  <a
                    href={version.chromeWebStoreUrl}
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chrome Web Store
                  </a>
                ) : (
                  "Chrome Web Store URL not configured"
                )}
              </dd>
            </dl>
          ) : (
            <p style={{ color: "var(--l-text-muted)" }}>
              Version endpoint unreachable. Health check:{" "}
              <Link href="/api/health" className="underline">
                /api/health
              </Link>
              .
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
