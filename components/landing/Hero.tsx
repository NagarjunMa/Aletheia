import { Fragment } from "react";

const stats = [
  { value: "Seconds", label: "Per first draft" },
  { value: "40", label: "Free starter credits" },
  { value: "100%", label: "Reviewed before sending" },
];

// Word-level stagger: split each headline line into individual words.
const headlineLines: Array<{ words: string[]; italic?: boolean }> = [
  { words: ["Write", "clearer", "first", "messages"] },
  { words: ["without", "starting", "from"] },
  { words: ["scratch."], italic: true },
];

/**
 * Brush-stroke SVG underline on the accent word, drawn with CSS stroke animation.
 * Luxury evergreen theme: stroke is emerald #50C878.
 */
function AccentUnderline({ delay = 0 }: { delay?: number }) {
  return (
    <svg
      viewBox="0 0 160 12"
      width="100%"
      height="12"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        bottom: "-6px",
        left: 0,
        right: 0,
        overflow: "visible",
      }}
      aria-hidden
    >
      <path
        className="landing-hero-underline-path"
        d="M4 8 Q40 4 80 8 Q120 12 156 6"
        fill="none"
        stroke="#50C878"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ animationDelay: `${delay}s` }}
      />
    </svg>
  );
}

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex flex-col items-center justify-center px-5 sm:px-8 pt-28 pb-16"
      style={{
        background: "var(--l-bg)",
        minHeight: "88vh",
        overflow: "hidden",
      }}
    >
      {/* ── Radial vignette — keeps center text readable ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, var(--l-bg) 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Ambient glow blobs ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "15%",
          left: "10%",
          width: "420px",
          height: "420px",
          background:
            "radial-gradient(circle, rgba(142,182,155,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "20%",
          right: "8%",
          width: "350px",
          height: "350px",
          background:
            "radial-gradient(circle, rgba(35,83,71,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Content layer ── */}
      <div
        className="relative mx-auto max-w-5xl w-full text-center"
        style={{ zIndex: 2 }}
      >
        {/* Eyebrow badge */}
        <div className="landing-hero-reveal mb-10 flex justify-center">
          <span className="section-label">Professional networking drafts</span>
        </div>

        {/* ── Headline — word-by-word stagger ── */}
        <h1
          aria-label="Write clearer first messages without starting from scratch."
          style={{
            fontFamily:
              "var(--font-flaviotte), Playfair Display, Georgia, serif",
            color: "var(--l-text)",
            lineHeight: 1.06,
            fontWeight: 900,
            fontSize: "clamp(2.4rem, 5.5vw, 5rem)",
            letterSpacing: "-0.02em",
          }}
        >
          {headlineLines.map((line, lineIdx) => {
            const isAccentLine = lineIdx === 1;
            const lineDelay = 0.18 + lineIdx * 0.15;

            return (
              <span
                key={lineIdx}
                className="block"
                style={{
                  fontStyle: line.italic ? "italic" : "normal",
                }}
              >
                {line.words.map((word, wordIdx) => {
                  const isHuman = isAccentLine && word === "from";
                  const wDelay = lineDelay + wordIdx * 0.07;

                  return (
                    <Fragment key={wordIdx}>
                      <span
                        className="landing-hero-word"
                        style={{
                          display: "inline-block",
                          position: "relative",
                          animationDelay: `${wDelay}s`,
                        }}
                      >
                        {isHuman && <AccentUnderline delay={wDelay + 0.5} />}
                        {word}
                      </span>
                      {wordIdx < line.words.length - 1 ? " " : null}
                    </Fragment>
                  );
                })}
              </span>
            );
          })}
        </h1>

        {/* Subheadline */}
        <p
          className="landing-hero-reveal mx-auto mt-8 max-w-2xl text-lg"
          style={{ color: "var(--l-text)", opacity: 0.82, lineHeight: 1.7 }}
        >
          Aletheia drafts LinkedIn connection notes, networking emails,
          follow-ups, and role-fit replies using your resume, your intent, and
          the profile you choose to reference. You review and edit every message
          before sending.
        </p>

        {/* CTAs */}
        <div className="landing-hero-reveal mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a href="/install" className="btn-primary">
            Get Aletheia on Chrome
          </a>
          <a href="/demo" className="btn-secondary">
            See a real draft
          </a>
        </div>

        {/* Launch info */}
        <p
          className="landing-hero-reveal mt-6 text-xs"
          style={{ color: "var(--l-text-dim)", letterSpacing: "0.05em" }}
        >
          Available for Chrome · 40 free credits · Daily usage limits
        </p>

        <p
          className="landing-hero-reveal mt-2 text-[10px] tracking-widest uppercase"
          style={{ color: "var(--l-text-dim)" }}
        >
          Chrome Web Store install · No credential access · No automated sending
        </p>
      </div>

      {/* Stats bar */}
      <div
        className="landing-hero-reveal relative mx-auto mt-16 w-full max-w-3xl"
        style={{ zIndex: 2 }}
      >
        <div className="divider" />
        <div
          className="grid grid-cols-3"
          style={{ borderRight: "1px solid var(--l-border)" }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center py-5 px-4"
              style={{ borderLeft: "1px solid var(--l-border)" }}
            >
              <span
                className="text-2xl font-black"
                style={{
                  fontFamily: "var(--font-flaviotte), Playfair Display, serif",
                  color: "var(--l-text)",
                }}
              >
                {s.value}
              </span>
              <span
                className="mt-1 text-xs"
                style={{
                  color: "var(--l-text-dim)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="divider" />
      </div>

      {/* Scroll indicator */}
      <div
        className="landing-scroll-indicator mt-10 flex flex-col items-center"
        aria-hidden
        style={{ zIndex: 2 }}
      >
        <div
          style={{
            width: 22,
            height: 36,
            border: "1.5px solid rgba(142,182,155,0.4)",
            borderRadius: 11,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "5px",
          }}
        >
          <div
            className="landing-scroll-dot"
            style={{
              width: 4,
              height: 8,
              background: "rgba(142,182,155,0.5)",
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </section>
  );
}
