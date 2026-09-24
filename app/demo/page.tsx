import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import DemoExample from "@/components/demo/DemoExample";
import ShaderBackground from "@/components/ShaderBackground";

export const metadata: Metadata = {
  title: "Illustrative example | Aletheia",
  description:
    "Explore a fictional, illustrative Aletheia workflow. See how selected context becomes a professional draft for you to review.",
  alternates: {
    canonical: "/demo",
  },
};

export default function DemoPage() {
  return (
    <div className="landing landing-marketing landing-demo">
      <ShaderBackground />
      <a className="landing-skip-link" href="#demo-content">
        Skip to example
      </a>
      <header className="landing-demo-nav">
        <Link
          href="/"
          className="landing-demo-brand"
          aria-label="Aletheia home"
        >
          <Image src="/Aletheia.svg" alt="" width={24} height={24} />
          <span>Aletheia</span>
        </Link>
        <Link href="/" className="landing-demo-back">
          <span aria-hidden="true">←</span> Back to home
        </Link>
      </header>

      <main id="demo-content" className="landing-demo-main">
        <div className="landing-demo-intro">
          <p className="landing-demo-eyebrow">Inside the workflow / 01—02</p>
          <h1>
            One illustrative context. <em>One reviewed draft.</em>
          </h1>
          <p className="landing-demo-lede">
            See how the context you choose can shape a professional
            introduction. This is a fictional example of the format and
            review-first workflow, not a customer outcome.
          </p>
        </div>

        <p className="landing-demo-disclosure">
          <strong>Illustrative data only.</strong> Every name, company,
          achievement, and message below is fictional. This page does not show a
          real person, customer, company relationship, or generated customer
          message.
        </p>

        <DemoExample />

        <div className="landing-demo-next">
          <div>
            <p className="landing-demo-eyebrow">Your context, your decision</p>
            <p>
              Aletheia prepares a draft. You review, edit, and decide whether to
              use it.
            </p>
          </div>
          <Link href="/install" className="btn-primary">
            Get Aletheia on Chrome <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
