"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Is it safe for my LinkedIn account?",
    a: "Yes. Aletheia reads profile information from the page you already have open — it never logs in, sends messages, or performs automated actions on your behalf. You always copy and paste the draft yourself.",
  },
  {
    q: "Does it support multiple languages?",
    a: "English only. Multi-language support is being explored but there is no confirmed timeline.",
  },
  {
    q: "How does the resume integration work?",
    a: "You upload resumes in your Aletheia dashboard and choose one primary resume for generation. When drafting, the AI uses that resume to ground the self-introduction - referencing your actual role, company, and relevant experience instead of inventing credentials. If no primary resume exists, the AI focuses on curiosity about the recipient rather than fabricating your background.",
  },
  {
    q: "Can I try it before paying?",
    a: "Absolutely. The trial gives you 40 credits with no expiry and no credit card required. LinkedIn connections use 2 credits; emails and InMails use 4.",
  },
  {
    q: "Does it work on LinkedIn Recruiter?",
    a: "Yes — Aletheia works across free LinkedIn, LinkedIn Premium, and LinkedIn Recruiter wherever you view a profile in Chrome.",
  },
  {
    q: "What does adaptive learning mean?",
    a: "When you accept a generated message (by copying it), Aletheia saves it as an example of your preferred writing style. After 3 accepted messages, the AI uses those examples to match your tone, sentence length, and vocabulary in future generations. This means the tool gets better the more you use it — adapting to your voice rather than imposing a generic one.",
  },
  {
    q: "What data does Aletheia send to its servers?",
    a: "When you generate a draft, Aletheia sends the recipient's public LinkedIn profile data (name, headline, experience, posts, skills) and your draft preferences (intent and format) to its API. Your primary resume is loaded from your Aletheia account on the server. HTML is stripped and injection patterns are blocked before the data reaches the model. No LinkedIn credentials are ever transmitted. Drafts you keep are stored locally in the extension to inform future drafts.",
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
