import type { Metadata } from "next";
import Link from "next/link";
import DemoExample from "@/components/demo/DemoExample";

export const metadata: Metadata = {
  title: "Illustrative example | Aletheia",
  description:
    "Explore a fictional, illustrative Aletheia workflow. See how selected context becomes a professional draft for you to review.",
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
          One illustrative context. One reviewed draft.
        </h1>
        <p
          className="mb-12 max-w-2xl text-sm"
          style={{ color: "var(--l-text-muted)" }}
        >
          This sample demonstrates format and workflow—not a customer outcome.
          Every name, company, achievement, and message below is fictional.
          Aletheia uses the same review-first approach when you choose your own
          context.
        </p>

        <p
          className="mb-8 border px-4 py-3 text-xs leading-relaxed"
          style={{
            borderColor: "var(--l-border)",
            background: "var(--l-surface)",
            color: "var(--l-text-muted)",
          }}
        >
          <strong style={{ color: "var(--l-text)" }}>
            Illustrative data only.
          </strong>{" "}
          This page does not show a real person, customer, company relationship,
          or generated customer message.
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
