"use client";

import Image from "next/image";
import ShaderBackground from "@/components/ShaderBackground";

const features = [
  { symbol: "◈", text: "Reads the profile you have open" },
  { symbol: "◉", text: "Drafts in your voice, grounded in your resume" },
  { symbol: "◊", text: "You review every draft before you send" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="landing auth-shell min-h-screen flex"
      style={{
        background: "transparent",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      {/* Shader background — shared with landing page */}
      <ShaderBackground />

      {/* ── Left: form panel ─────────────────────────────── */}
      <main className="w-full lg:w-1/2 flex items-center justify-center px-6 py-16 relative z-10 overflow-hidden">
        {/* Vignette to focus attention on form */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.70) 100%)",
            pointerEvents: "none",
          }}
        />
        <div className="relative z-10 w-full max-w-[420px]">{children}</div>
      </main>

      {/* ── Right: branding panel ─────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative z-10 overflow-hidden items-center justify-center"
        style={{ borderLeft: "1px solid rgba(120,180,155,0.16)" }}
      >
        {/* Watermark */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "28rem",
              fontWeight: 900,
              color: "rgba(120,180,155,0.035)",
              lineHeight: 1,
              fontStyle: "italic",
            }}
          >
            A
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md px-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <Image src="/Aletheia.svg" alt="Aletheia" width={28} height={28} />
            <span
              style={{
                fontFamily: "var(--font-flaviotte), Georgia, serif",
                fontWeight: 400,
                fontSize: "1.25rem",
                color: "#F7FAF9",
                letterSpacing: "0.06em",
              }}
            >
              Aletheia
            </span>
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(2rem, 3.5vw, 2.8rem)",
              lineHeight: 1.08,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              marginBottom: "1.25rem",
            }}
          >
            LinkedIn outreach that sounds{" "}
            <em style={{ fontStyle: "italic", color: "#78B49B" }}>human.</em>
          </h2>

          {/* Subtext */}
          <p
            style={{
              color: "rgba(247,250,249,0.7)",
              fontSize: "0.875rem",
              lineHeight: 1.7,
              marginBottom: "2.5rem",
            }}
          >
            Reads the profile you have open, drafts a short personal note
            grounded in your resume — before you hit send.
          </p>

          {/* Feature bullets */}
          <div
            style={{
              borderTop: "1px solid rgba(120,180,155,0.18)",
              paddingTop: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  style={{
                    color: "#78B49B",
                    fontSize: "0.7rem",
                    marginTop: "2px",
                    flexShrink: 0,
                  }}
                >
                  {f.symbol}
                </span>
                <span
                  style={{
                    color: "rgba(247,250,249,0.7)",
                    fontSize: "0.8rem",
                    lineHeight: 1.6,
                  }}
                >
                  {f.text}
                </span>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div
            className="glass-aurora"
            style={{ marginTop: "2.5rem", padding: "1.25rem" }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                color: "rgba(247,250,249,0.76)",
                lineHeight: 1.6,
              }}
            >
              Grounded drafts stay under your control from context selection to
              final review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
