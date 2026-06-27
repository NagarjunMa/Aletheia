"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Does Aletheia send messages for me?",
    a: "No. Aletheia drafts messages. It does not send messages, click buttons, submit forms, or take actions on your behalf.",
  },
  {
    q: "Does Aletheia collect my LinkedIn password?",
    a: "No. Aletheia does not ask for or collect LinkedIn credentials.",
  },
  {
    q: "How does resume support work?",
    a: "You upload resumes in your dashboard and choose one as your primary resume. Drafts can use that resume to reference your actual skills, projects, and experience.",
  },
  {
    q: "What can I draft with Aletheia?",
    a: "You can draft LinkedIn connection notes, networking emails, follow-ups, referral requests, and role-fit replies.",
  },
  {
    q: "Do I have to send the draft?",
    a: "No. You always review the draft first. You can edit, regenerate, copy, approve, or reject it.",
  },
  {
    q: "Where do I install Aletheia?",
    a: "Aletheia is available through the official Chrome Web Store listing.",
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
                fontFamily: "var(--font-flaviotte), Playfair Display, serif",
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
              >
                <span
                  className="text-xs font-bold tracking-widest uppercase pr-8"
                  style={{
                    color: open === i ? "var(--l-text)" : "var(--l-text-muted)",
                    transition: "color 0.15s ease",
                  }}
                >
                  {faq.q}
                </span>
                <span style={{ color: "var(--l-blue)", flexShrink: 0 }}>
                  {open === i ? <Minus size={14} /> : <Plus size={14} />}
                </span>
              </button>

              <div
                className={`landing-faq-panel ${open === i ? "open" : ""}`}
                aria-hidden={open !== i}
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
