import Link from "next/link";

const CHROME_WEB_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ??
  "https://chromewebstore.google.com/search/Aletheia";

export default function CTA() {
  return (
    <section
      id="cta"
      className="relative py-32 px-5 sm:px-8"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-5xl pt-24">
        <div className="landing-section-reveal grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <span className="section-label mb-6 block">Get the extension</span>
            <h2
              style={{
                fontFamily: "var(--font-flaviotte), Playfair Display, serif",
                fontWeight: 900,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.08,
                color: "var(--l-text)",
                letterSpacing: "-0.02em",
              }}
            >
              Install from the{" "}
              <em style={{ fontStyle: "italic" }}>Chrome Web Store.</em>
            </h2>
            <p
              className="mt-5 text-sm leading-relaxed"
              style={{ color: "var(--l-text-muted)", maxWidth: "48ch" }}
            >
              Aletheia is available as a Chrome extension. Install it from the
              official Chrome Web Store listing, sign in, add your primary
              resume in the dashboard, and start drafting reviewed professional
              messages.
            </p>

            <p className="mt-6 text-xs" style={{ color: "var(--l-text-dim)" }}>
              40 free credits · Browser-managed updates · User-reviewed drafts
            </p>
          </div>

          {/* Download panel */}
          <div
            className="p-10"
            style={{
              background: "var(--l-surface)",
              border: "1px solid var(--l-border)",
            }}
          >
            <p
              className="mb-6 text-xs font-bold tracking-widest uppercase"
              style={{ color: "var(--l-text)" }}
            >
              Available for Chrome
            </p>
            <a
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full justify-center"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              Get Aletheia on Chrome
            </a>
            <p
              className="mt-4 text-center text-xs"
              style={{ color: "var(--l-text-dim)" }}
            >
              Official Chrome Web Store install
            </p>
            <div
              className="mt-6 pt-6 text-center text-xs tracking-widest uppercase"
              style={{
                borderTop: "1px solid var(--l-border)",
                color: "var(--l-text-dim)",
              }}
            >
              <Link href="/demo" style={{ color: "var(--l-text-dim)" }}>
                See a real draft first →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
