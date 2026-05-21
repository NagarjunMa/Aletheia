import type { Metadata } from "next";
import Link from "next/link";
import DemoExample from "@/components/demo/DemoExample";

export const metadata: Metadata = {
  title: "Demo — see a real draft | Aletheia",
  description:
    "See the exact input and output Aletheia produces. No sign-up, no install, just one rendered example.",
};

export default function DemoPage() {
  return (
    <main
      className="landing min-h-screen px-5 sm:px-8 py-24"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--l-text-dim)" }}
        >
          ← Back to home
        </Link>
        <h1
          className="mt-8 mb-3"
          style={{
            fontFamily: "var(--font-flaviotte), serif",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 900,
            color: "var(--l-text)",
          }}
        >
          One profile in. One note out.
        </h1>
        <p
          className="mb-12 max-w-2xl text-sm"
          style={{ color: "var(--l-text-muted)" }}
        >
          This is real output from a real Claude generation. No sign-up. No
          install. If the note below sounds like something you would actually
          send, the rest of the product works the same — one click per profile
          in your browser.
        </p>

        <DemoExample />

        <div className="mt-14 flex flex-col items-center gap-3">
          <Link href="/#cta" className="btn-primary">
            Join the Waitlist
          </Link>
          <Link
            href="/ascendia-extension.zip"
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--l-text-dim)" }}
          >
            Or download the extension (.zip)
          </Link>
        </div>
      </div>
    </main>
  );
}
