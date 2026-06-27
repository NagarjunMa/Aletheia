import type { Metadata } from "next";
import Link from "next/link";
import DemoExample from "@/components/demo/DemoExample";

export const metadata: Metadata = {
  title: "Demo — see a real draft | Aletheia",
  description:
    "See a sample Aletheia draft. No sign-up, no install, just one rendered example.",
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
          One context. One reviewed draft.
        </h1>
        <p
          className="mb-12 max-w-2xl text-sm"
          style={{ color: "var(--l-text-muted)" }}
        >
          This sample shows the kind of concise draft Aletheia is designed to
          prepare. No sign-up. No install. If the note below sounds like
          something you would actually edit and send, the product follows the
          same review-first workflow.
        </p>

        <DemoExample />

        <div className="mt-14 flex flex-col items-center gap-3">
          <Link href="/install" className="btn-primary">
            Get Aletheia on Chrome
          </Link>
          <Link
            href="/"
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--l-text-dim)" }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
