import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ShaderBackground from "@/components/ShaderBackground";

const CHROME_WEB_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ??
  "https://chromewebstore.google.com/detail/pneenlhefkghefjpaafgllkjkpfjnkgg";

export const metadata: Metadata = {
  title: "Install Aletheia from the Chrome Web Store",
  description:
    "Install the official Aletheia Chrome extension to prepare reviewed LinkedIn connection notes, InMail, tailored emails, and grounded YC application answers.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/install",
  },
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "Open the Chrome Web Store listing",
    body: "Use the official Aletheia listing to install the extension in Chrome.",
  },
  {
    title: "Add the extension to Chrome",
    body: "Click Add to Chrome and confirm the browser permission prompt.",
  },
  {
    title: "Sign in to Aletheia",
    body: "Open the extension, sign in, and connect it to your Aletheia account.",
  },
  {
    title: "Add your primary resume",
    body: "Upload or select your primary resume in the dashboard so drafts can reference your real background.",
  },
  {
    title: "Draft and review",
    body: "Open a supported profile or opportunity, choose your message type, and review the draft before you use it. Optional auto-fill can place a reviewed draft in a supported field; it never sends or submits anything.",
  },
];

export default function InstallPage() {
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
            Aletheia is available through the Chrome Web Store. Install it from
            the official listing to receive browser-managed updates.
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
            Official install
          </p>
          <p className="text-2xl" style={{ color: "var(--l-text)" }}>
            Chrome Web Store
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={CHROME_WEB_STORE_URL}
              className="btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Chrome Web Store
            </a>
            <Link
              href="/demo"
              className="text-xs tracking-widest uppercase"
              style={{ color: "var(--l-text-dim)" }}
            >
              View an illustrative example →
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
            Start in 5 steps
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
            User control
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Aletheia creates drafts only. You review, edit, copy, approve, or
            reject each message before deciding what to send. It does not click
            Send, submit forms, or contact people on your behalf.
          </p>
        </section>

        <p
          className="text-center text-xs"
          style={{ color: "var(--l-text-dim)" }}
        >
          Includes one 40-credit trial. Refill checkout is not currently
          available.
        </p>

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
