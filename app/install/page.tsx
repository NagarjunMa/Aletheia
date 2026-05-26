import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ShaderBackground from "@/components/ShaderBackground";

export const metadata: Metadata = {
  title: "Install Aletheia — Chrome Extension",
  description:
    "Download and install the Aletheia Chrome extension. Step-by-step guide for sideloading while we await Chrome Web Store approval.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

async function getVersionMeta(): Promise<{
  version: string;
  sha: string;
  sizeBytes: number;
} | null> {
  try {
    const res = await fetch(
      new URL(
        "/api/extension/version",
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      ),
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const STEPS: { title: string; body: string }[] = [
  {
    title: "Download the .zip",
    body: "Click the Download button above. Save the file somewhere you can find it — Desktop works fine.",
  },
  {
    title: "Unzip it",
    body: "Mac: double-click the .zip — Finder creates an aletheia-ext folder next to it. Windows: right-click → Extract All.",
  },
  {
    title: "Open Chrome extensions",
    body: "Paste chrome://extensions into the address bar and press Enter.",
  },
  {
    title: "Enable Developer mode",
    body: "Toggle the Developer mode switch in the top-right corner of the page.",
  },
  {
    title: "Load unpacked",
    body: "Click the Load unpacked button (top-left) and select the unzipped Aletheia folder.",
  },
  {
    title: "Pin the icon",
    body: "Click the puzzle-piece icon in Chrome's toolbar, find Aletheia, and pin it so it's always one click away.",
  },
  {
    title: "Sign in + start drafting",
    body: "Click the Aletheia icon, sign in with email or Google, open a LinkedIn profile, and draft your first message.",
  },
];

export default async function InstallPage() {
  const meta = await getVersionMeta();
  const sizeKb = meta ? (meta.sizeBytes / 1024).toFixed(1) : null;

  return (
    <div className="landing">
      <ShaderBackground />
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        <header className="mb-12">
          <p
            className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--l-blue)" }}
          >
            Install
          </p>
          <h1
            className="font-serif text-5xl md:text-6xl"
            style={{
              color: "var(--l-text)",
              lineHeight: 1.1,
              fontFamily: "var(--font-flaviotte), Playfair Display, serif",
            }}
          >
            Install Aletheia
          </h1>
          <p
            className="mt-6 max-w-2xl text-sm leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Aletheia is awaiting Chrome Web Store approval. Until then, you can
            sideload the extension directly. Takes about 60 seconds.
          </p>
        </header>

        <section
          className="mb-14 p-8"
          style={{
            background: "var(--l-surface)",
            border: "1px solid var(--l-border)",
          }}
        >
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--l-text-dim)" }}
          >
            Latest Build
          </p>
          <p className="text-2xl" style={{ color: "var(--l-text)" }}>
            {meta ? `v${meta.version}` : "v1.0.0"}
            <span
              className="ml-3 text-xs tracking-widest uppercase"
              style={{ color: "var(--l-text-dim)" }}
            >
              {sizeKb ? `${sizeKb} KB` : ""}
              {meta?.sha ? ` · ${meta.sha}` : ""}
            </span>
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="/ascendia-extension.zip" className="btn-primary" download>
              Download .zip
            </a>
            <Link
              href="/demo"
              className="text-xs tracking-widest uppercase"
              style={{ color: "var(--l-text-dim)" }}
            >
              See a real draft first →
            </Link>
          </div>
        </section>

        <section className="mb-14">
          <h2
            className="mb-8 font-serif text-3xl"
            style={{
              color: "var(--l-text)",
              fontFamily: "var(--font-flaviotte), Playfair Display, serif",
            }}
          >
            Install in 7 steps
          </h2>
          <ol className="space-y-6">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-5 p-5"
                style={{
                  background: "var(--l-surface)",
                  border: "1px solid var(--l-border)",
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold"
                  style={{
                    background: "rgba(112,184,200,0.12)",
                    color: "var(--l-blue)",
                    border: "1px solid rgba(112,184,200,0.25)",
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <p
                    className="mb-1 text-sm font-bold"
                    style={{ color: "var(--l-text)" }}
                  >
                    {step.title}
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--l-text-muted)" }}
                  >
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="p-6"
          style={{
            background: "rgba(112,184,200,0.06)",
            border: "1px solid rgba(112,184,200,0.18)",
          }}
        >
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--l-blue)" }}
          >
            Heads up
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Sideloading is temporary. As soon as Chrome Web Store approves
            Aletheia, this page will redirect to the store listing and updates
            will install automatically. For now, you may see a yellow
            &ldquo;unsupported extension&rdquo; banner from Chrome — that&apos;s
            normal for unpacked extensions and is safe to dismiss.
          </p>
        </section>

        <div className="mt-12 flex justify-center">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--l-text-dim)" }}
          >
            ← Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
