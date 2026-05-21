"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

const stats = [
  { value: "Seconds", label: "Per draft" },
  { value: "270", label: "Chars, LinkedIn-ready" },
  { value: "0", label: "Tabs to juggle" },
];

// Word-level stagger: split each headline line into individual words.
// "One click." is kept as a single token so the sage underline spans both words.
const headlineLines: Array<{ words: string[]; italic?: boolean }> = [
  { words: ["Their", "profile,", "your", "resume."] },
  { words: ["One", "draft.", "One click."] }, // "One click." gets SVG underline
  { words: ["No", "tabs", "to", "juggle."], italic: true },
];

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Brush-stroke SVG underline on "human" — drawn with pathLength animation.
 * Forest-green theme: stroke is sage #8EB69B.
 */
function AccentUnderline({ delay = 0 }: { delay?: number }) {
  return (
    <motion.svg
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
      <motion.path
        d="M4 8 Q40 4 80 8 Q120 12 156 6"
        fill="none"
        stroke="#8EB69B"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay, ease }}
      />
    </motion.svg>
  );
}

export default function Hero() {
  const [scrolledPast, setScrolledPast] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const threshold = window.innerHeight * 0.4;
    const handler = () => setScrolledPast(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <section
      ref={sectionRef}
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
        <motion.div
          className="mb-10 flex justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease }}
        >
          <span className="section-label">LinkedIn outreach, made easier</span>
        </motion.div>

        {/* ── Headline — word-by-word stagger ── */}
        <h1
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
            const isAccentLine = lineIdx === 1; // "One draft. One click."
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
                  const isHuman = isAccentLine && word === "One click.";
                  const wDelay = lineDelay + wordIdx * 0.07;

                  return (
                    <motion.span
                      key={wordIdx}
                      style={{
                        display: "inline-block",
                        marginRight:
                          wordIdx < line.words.length - 1 ? "0.3em" : 0,
                        position: "relative",
                      }}
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.65, delay: wDelay, ease }}
                    >
                      {/* Sage underline on "human" */}
                      {isHuman && <AccentUnderline delay={wDelay + 0.5} />}
                      {word}
                    </motion.span>
                  );
                })}
              </span>
            );
          })}
        </h1>

        {/* Subheadline */}
        <motion.p
          className="mx-auto mt-8 max-w-2xl text-lg"
          style={{ color: "#204050", lineHeight: 1.7 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.72, ease }}
        >
          Writing a thoughtful connection note means remembering their last
          role, your overlap, the recent post worth mentioning — every time.
          Aletheia keeps track. Open the profile, click Generate. You get a
          short, personal note in your voice, ready to send.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.86, ease }}
        >
          <a
            href="#cta"
            className="btn-primary"
            onClick={(e) => {
              e.preventDefault();
              document
                .querySelector("#cta")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Join the Waitlist
          </a>
          <a href="/demo" className="btn-secondary">
            See a real draft
          </a>
        </motion.div>

        {/* Launch info */}
        <motion.p
          className="mt-6 text-xs"
          style={{ color: "var(--l-text-dim)", letterSpacing: "0.05em" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.05 }}
        >
          Coming soon to Chrome Web Store · Free tier · 30 drafts/day
        </motion.p>

        <motion.p
          className="mt-2 text-[10px] tracking-widest uppercase"
          style={{ color: "var(--l-text-dim)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.18 }}
        >
          Profile HTML stripped in your browser · No background scraping
        </motion.p>
      </div>

      {/* Stats bar */}
      <motion.div
        className="relative mx-auto mt-16 w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.1, ease }}
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
      </motion.div>

      {/* Scroll indicator — fades out past 40vh */}
      <motion.div
        className="mt-10 flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: scrolledPast ? 0 : 0.6 }}
        transition={{ duration: 0.4 }}
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
          <motion.div
            style={{
              width: 4,
              height: 8,
              background: "rgba(142,182,155,0.5)",
              borderRadius: 2,
            }}
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
