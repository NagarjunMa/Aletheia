"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
    a: "The extension includes a resume field where you paste your background. When generating messages, the AI uses your resume to ground the self-introduction — referencing your actual role, company, and relevant experience instead of inventing credentials. If the resume field is empty, the AI focuses on curiosity about the recipient rather than fabricating your background.",
  },
  {
    q: "Can I try it before paying?",
    a: "Absolutely. The Free tier gives you 30 messages per day, forever — no credit card required. That's usually enough to evaluate whether Aletheia is right for you.",
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
    a: "When you generate a draft, Aletheia sends the recipient's public LinkedIn profile data (name, headline, experience, posts, skills) and your draft preferences (intent, format, resume) to its API. HTML is stripped and injection patterns are blocked before the data leaves your browser. The API passes the sanitized data to the Anthropic Claude model that produces the draft. No LinkedIn credentials are ever transmitted. Drafts you keep are stored locally in the extension to inform future drafts — they are not sent to any server.",
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
          >
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
          </motion.div>

          <motion.p
            className="text-sm leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
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
          </motion.p>
        </div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
        >
          {faqs.map((faq, i) => (
            <div key={i}>
              <div className="divider" />
              <button
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

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <p
                      className="pb-8 text-sm leading-relaxed"
                      style={{ color: "var(--l-text-muted)" }}
                    >
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          <div className="divider" />
        </motion.div>
      </div>
    </section>
  );
}
