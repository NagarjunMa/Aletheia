"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "What can I prepare with Aletheia?",
    a: "Aletheia supports LinkedIn connection notes, cold email, LinkedIn InMail, follow-ups, referral requests, role-fit summaries, and grounded YC application answers.",
  },
  {
    q: "What does the extension access?",
    a: "Aletheia works from supported LinkedIn and Apollo pages you open, plus the resume and application-profile context you choose in your Aletheia account. It does not ask for your LinkedIn password.",
  },
  {
    q: "How do resumes and evidence work?",
    a: "You can manage multiple resumes and select a primary version. For YC application answers, Aletheia can also use the evidence you have confirmed in your application profile. That evidence is user-confirmed, not independently verified by Aletheia.",
  },
  {
    q: "Does Aletheia always get the draft right?",
    a: "No. AI output can be incomplete, inaccurate, or not sound like you. Treat every draft as a starting point and check the facts, tone, and next step before you use it.",
  },
  {
    q: "Can Aletheia learn my writing preferences?",
    a: "When you approve or reject drafts, that feedback can help Aletheia learn the wording and structure you prefer. You still review every new draft and make the final decision.",
  },
  {
    q: "Does Aletheia fill or send messages?",
    a: "You may choose to fill a reviewed draft into a supported message field. Aletheia never clicks Send, submits a form, auto-connects, or contacts anyone for you.",
  },
  {
    q: "What does Aletheia cost today?",
    a: "New accounts receive one 40-credit trial. Connection notes use 2 credits; cold email, InMail, and YC application answers use 4. Refill checkout is not currently available, and no paid plan is being offered on this site.",
  },
  {
    q: "Where can I install Aletheia?",
    a: "Aletheia is available through the official Chrome Web Store listing. You can also explore a clearly labeled illustrative example before installing.",
  },
  {
    q: "Is Aletheia affiliated with LinkedIn?",
    a: "No. Aletheia is an independent product and is not affiliated with, endorsed by, or sponsored by LinkedIn.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="relative py-28 px-5 sm:px-8"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-20">
        {/* Header */}
        <div className="mb-16 grid md:grid-cols-2 gap-8 md:gap-12 items-end">
          <div className="landing-section-reveal">
            <span className="section-label mb-5 block">FAQ</span>
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
              Honest <em style={{ fontStyle: "italic" }}>answers.</em>
            </h2>
          </div>

          <p
            className="landing-section-reveal text-sm leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Can&apos;t find the answer you&apos;re looking for?{" "}
            <a
              href="mailto:hello@aletheia.live"
              style={{
                color: "var(--l-blue)",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Email us →
            </a>
          </p>
        </div>

        {/* Accordion */}
        <div className="landing-section-reveal">
          {faqs.map((faq, i) => (
            <div key={i}>
              <div className="divider" />
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between py-6 text-left cursor-pointer group"
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
              >
                <span
                  id={`faq-question-${i}`}
                  className="text-xs font-bold tracking-widest uppercase pr-8"
                  style={{
                    color: open === i ? "var(--l-text)" : "var(--l-text-muted)",
                    transition: "color 0.15s ease",
                  }}
                >
                  {faq.q}
                </span>
                <span style={{ color: "var(--l-blue)", flexShrink: 0 }}>
                  {open === i ? (
                    <Minus size={14} aria-hidden="true" />
                  ) : (
                    <Plus size={14} aria-hidden="true" />
                  )}
                </span>
              </button>

              <div
                id={`faq-panel-${i}`}
                className={`landing-faq-panel ${open === i ? "open" : ""}`}
                aria-hidden={open !== i}
                aria-labelledby={`faq-question-${i}`}
                role="region"
              >
                <p
                  className="pb-8 text-sm leading-relaxed"
                  style={{
                    color: "var(--l-text-muted)",
                    background: "var(--l-surface-dark)",
                    backdropFilter: "blur(6px)",
                    padding: "1rem 1.25rem 2rem",
                  }}
                >
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
          <div className="divider" />
        </div>
      </div>
    </section>
  );
}
