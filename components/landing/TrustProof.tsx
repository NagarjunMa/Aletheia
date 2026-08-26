import Link from "next/link";

const CHROME_WEB_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ??
  "https://chromewebstore.google.com/detail/pneenlhefkghefjpaafgllkjkpfjnkgg";

const proofLinks = [
  { label: "Illustrative example", href: "/demo", external: false },
  { label: "Current status", href: "/status", external: false },
  { label: "Privacy Policy", href: "/privacy", external: false },
  { label: "Terms of Service", href: "/terms", external: false },
  { label: "Chrome Web Store", href: CHROME_WEB_STORE_URL, external: true },
];

export default function TrustProof() {
  return (
    <section
      id="trust"
      className="relative px-5 py-28 sm:px-8"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />
      <div className="mx-auto max-w-7xl pt-20">
        <div className="landing-section-reveal grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <div>
            <span className="section-label mb-5 block">
              Trust, made visible
            </span>
            <h2
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontWeight: 900,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.08,
                color: "var(--l-text)",
                letterSpacing: "-0.02em",
              }}
            >
              Clear boundaries are part of the product.
            </h2>
          </div>
          <div
            className="grid gap-px sm:grid-cols-2"
            style={{ background: "var(--l-border)" }}
          >
            <p
              className="p-6 text-sm leading-relaxed"
              style={{
                background: "var(--l-surface)",
                color: "var(--l-text-muted)",
              }}
            >
              Aletheia uses the supported page you open and the account context
              you choose. It does not ask for your LinkedIn password.
            </p>
            <p
              className="p-6 text-sm leading-relaxed"
              style={{
                background: "var(--l-surface)",
                color: "var(--l-text-muted)",
              }}
            >
              Optional auto-fill places a reviewed draft into a supported field.
              Aletheia never clicks Send, submits a form, or contacts anyone for
              you.
            </p>
          </div>
        </div>

        <nav
          aria-label="Public trust resources"
          className="landing-section-reveal mt-10 flex flex-wrap gap-x-7 gap-y-4"
        >
          {proofLinks.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "var(--l-blue)" }}
              >
                {link.label} ↗
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "var(--l-blue)" }}
              >
                {link.label} →
              </Link>
            ),
          )}
          <a
            href="mailto:hello@aletheia.live"
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--l-blue)" }}
          >
            hello@aletheia.live →
          </a>
        </nav>
      </div>
    </section>
  );
}
