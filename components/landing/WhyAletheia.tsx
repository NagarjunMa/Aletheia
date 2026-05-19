"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Clock, Bot, Sparkles } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

type Card = {
  icon: typeof Clock;
  badge: string;
  title: string;
  body: string;
  tag: string;
};

const cards: Card[] = [
  {
    icon: Clock,
    badge: "The reading tax",
    title: "Every note is a tab tour.",
    body: "Skim their experience. Find the recent post worth mentioning. Note the overlap with your resume. Draft the opener. Trim it twice. Fifteen minutes per recipient before you hit send.",
    tag: "01",
  },
  {
    icon: Bot,
    badge: "The memory tax",
    title: "Twenty profiles, each different.",
    body: "You keep the context in your head — last role, mutual interest, the angle worth opening on — or you open five tabs and copy-paste through it. Neither scales past a busy afternoon.",
    tag: "02",
  },
  {
    icon: Sparkles,
    badge: "The Aletheia way",
    title: "You stay personal. It stays short.",
    body: "Aletheia reads the profile you have open, pulls the angle that ties to your resume, drafts a short note in your voice. Open profile, click Generate, review, send. Same care, none of the tab juggling.",
    tag: "03",
  },
];

export default function WhyAletheia() {
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.set(".why-card", { opacity: 0, y: 60 });
      gsap.set(".why-header > *", { opacity: 0, y: 30 });

      ScrollTrigger.batch(".why-header > *", {
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

      ScrollTrigger.batch(".why-card", {
        onEnter: (els) =>
          gsap.to(els, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.14,
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
      id="features"
      className="relative px-8 py-32"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-24">
        {/* Header */}
        <div className="why-header mb-20 grid gap-12 md:grid-cols-2 md:items-end">
          <div>
            <span className="section-label mb-5 block">Why Aletheia</span>
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
              Personal outreach shouldn&apos;t cost you{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400 }}>
                an afternoon
              </em>
              .
            </h2>
          </div>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Reaching out the right way means reading the profile, lining it up
            with your resume, finding the real overlap, and writing the opener.
            Aletheia handles the reading and drafting on the page you already
            have open. You stay personal. You stay in control.
          </p>
        </div>

        {/* Cards — GSAP scroll-reveal */}
        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.tag}
                className="why-card relative flex flex-col p-8"
                style={{
                  background: "#0c1f1d",
                  border: "1px solid var(--l-border)",
                  minHeight: "380px",
                }}
              >
                <div className="mb-6 flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center"
                    style={{
                      background: "var(--l-surface-3)",
                      border: "1px solid var(--l-border)",
                    }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      style={{ color: "var(--l-blue)" }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-bold tracking-widest"
                    style={{ color: "var(--l-text-dim)" }}
                  >
                    {card.tag}
                  </span>
                </div>

                <span
                  className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: "var(--l-blue)" }}
                >
                  {card.badge}
                </span>

                <h3
                  className="mb-4 text-xl"
                  style={{
                    fontFamily:
                      "var(--font-flaviotte), Playfair Display, serif",
                    fontWeight: 700,
                    color: "var(--l-text)",
                    lineHeight: 1.25,
                  }}
                >
                  {card.title}
                </h3>

                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--l-text-muted)" }}
                >
                  {card.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
