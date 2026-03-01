'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    q: 'Is it safe for my LinkedIn account?',
    a: 'Yes. Aletheia reads profile information from the page you already have open — it never logs in, sends messages, or performs automated actions on your behalf. You always copy and paste the draft yourself.',
  },
  {
    q: 'Does it support multiple languages?',
    a: 'Currently Aletheia generates messages in English only. Multi-language support is on the roadmap for early 2025.',
  },
  {
    q: 'How does the resume integration work?',
    a: "At the moment Aletheia reads the recipient's profile — not your own. A feature to incorporate your resume context into messages is planned for the Pro tier later this year.",
  },
  {
    q: 'Can I try it before paying?',
    a: "Absolutely. The Free tier gives you 30 messages per day, forever — no credit card required. That's usually enough to evaluate whether Aletheia is right for you.",
  },
  {
    q: 'Does it work on LinkedIn Recruiter?',
    a: 'Yes — Aletheia works across free LinkedIn, LinkedIn Premium, and LinkedIn Recruiter wherever you view a profile in Chrome.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="relative py-28 px-8" style={{ background: 'var(--l-bg)' }}>
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-20">
        {/* Header — 2-col on desktop */}
        <div className="mb-16 grid md:grid-cols-2 gap-12 items-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="section-label mb-5 block">FAQ</span>
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 900,
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                lineHeight: 1.08,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Common{' '}
              <em style={{ fontStyle: 'italic' }}>Questions.</em>
            </h2>
          </motion.div>

          <motion.p
            className="text-sm leading-relaxed"
            style={{ color: '#64748b' }}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Can&apos;t find the answer you&apos;re looking for?{' '}
            <a
              href="mailto:hello@aletheia.ai"
              style={{ color: '#2d4ba0', fontWeight: 700, textDecoration: 'none' }}
            >
              Email us →
            </a>
          </motion.p>
        </div>

        {/* Accordion — P1 fix: full max-w-7xl width, not capped at 65ch on the row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
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
                  className="text-xs font-bold tracking-widest uppercase transition-colors duration-150 pr-8"
                  style={{ color: open === i ? '#0f172a' : '#475569' }}
                >
                  {faq.q}
                </span>
                <span
                  style={{ color: '#2d4ba0', flexShrink: 0 }}
                >
                  {open === i ? <Minus size={14} /> : <Plus size={14} />}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {/* P1 fix: removed max-w: 65ch constraint — answer spans full row width */}
                    <p className="pb-8 text-sm leading-relaxed" style={{ color: '#64748b' }}>
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
  )
}
