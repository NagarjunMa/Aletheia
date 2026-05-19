"use client";

/**
 * Testimonials section.
 *
 * STATUS: HIDDEN FROM LANDING (2026-05-19)
 * --------------------------------------------------------------
 * Component is intentionally NOT mounted in app/page.tsx. Import
 * + render were commented out pending real beta-user quotes.
 * Re-enable by uncommenting both lines in app/page.tsx once the
 * three placeholder entries below are replaced with attributed
 * quotes (name + role + photo permission).
 *
 * IMPORTANT: Do not ship fabricated names/photos — triggers the
 * phishing/scam classifiers cleaned up earlier.
 *
 * Workflow:
 *   1. Get 3+ beta users (students + experienced) to give a 1-2
 *      sentence quote + name + role + photo permission.
 *   2. Replace placeholder entries in `testimonials` below.
 *   3. Set SHOW_PLACEHOLDER_BANNER to false.
 *   4. Uncomment <Testimonials /> in app/page.tsx.
 */

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  context: string;
};

// TODO(testimonials): replace placeholder entries with real beta users.
// Each entry MUST be backed by written permission from the person to publish
// their name, role, and quote on the landing page.
const testimonials: Testimonial[] = [
  {
    id: "placeholder-1",
    quote: "[Real student quote goes here once collected.]",
    name: "[Real Name]",
    role: "[Program / School]",
    context: "Student",
  },
  {
    id: "placeholder-2",
    quote: "[Real engineer / IC quote goes here once collected.]",
    name: "[Real Name]",
    role: "[Role at Company]",
    context: "Working professional",
  },
  {
    id: "placeholder-3",
    quote: "[Real recruiter / hiring manager quote goes here once collected.]",
    name: "[Real Name]",
    role: "[Role at Company]",
    context: "Experienced",
  },
];

const SHOW_PLACEHOLDER_BANNER = true;

export default function Testimonials() {
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.set(".t-card", { opacity: 0, y: 50 });
      gsap.set(".t-header > *", { opacity: 0, y: 24 });

      ScrollTrigger.batch(".t-header > *", {
        onEnter: (els) =>
          gsap.to(els, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.1,
            ease: "power3.out",
          }),
        start: "top 85%",
        once: true,
      });

      ScrollTrigger.batch(".t-card", {
        onEnter: (els) =>
          gsap.to(els, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.12,
            ease: "power3.out",
          }),
        start: "top 85%",
        once: true,
      });
    },
    { scope: container },
  );

  return (
    <section
      ref={container}
      id="testimonials"
      className="relative px-8 py-32"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-24">
        <div className="t-header mb-16 grid gap-12 md:grid-cols-2 md:items-end">
          <div>
            <span className="section-label mb-5 block">Voices from beta</span>
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
              From students and seasoned engineers.
            </h2>
          </div>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Beta users — students cold-messaging recruiters, engineers reaching
            out to senior ICs, founders pinging investors — describe how
            Aletheia changed the way they open conversations on LinkedIn.
          </p>
        </div>

        {SHOW_PLACEHOLDER_BANNER && (
          <div
            className="mb-10 p-4 text-sm"
            style={{
              background: "var(--l-surface-2)",
              border: "1px dashed var(--l-border)",
              color: "var(--l-text-dim)",
            }}
          >
            <strong style={{ color: "var(--l-text-muted)" }}>
              Placeholder.
            </strong>{" "}
            Real attributed quotes from beta users land here before launch. Set{" "}
            <code style={{ color: "var(--l-blue)" }}>
              SHOW_PLACEHOLDER_BANNER
            </code>{" "}
            to <code style={{ color: "var(--l-blue)" }}>false</code> once quotes
            are collected and the entries below are replaced with real names.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <article
              key={t.id}
              className="t-card flex flex-col p-8"
              style={{
                background: "var(--l-surface)",
                border: "1px solid var(--l-border)",
                minHeight: "280px",
              }}
            >
              <span
                aria-hidden
                className="mb-4 text-4xl leading-none"
                style={{
                  fontFamily: "var(--font-flaviotte), Playfair Display, serif",
                  color: "var(--l-blue)",
                }}
              >
                &ldquo;
              </span>

              <p
                className="mb-6 flex-1 text-sm leading-relaxed"
                style={{ color: "var(--l-text-muted)" }}
              >
                {t.quote}
              </p>

              <div
                className="pt-4"
                style={{ borderTop: "1px solid var(--l-border-subtle)" }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--l-text)" }}
                >
                  {t.name}
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--l-text-dim)" }}
                >
                  {t.role}
                </p>
                <p
                  className="mt-2 text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--l-blue)" }}
                >
                  {t.context}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
