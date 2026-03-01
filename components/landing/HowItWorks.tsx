'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    num: '01',
    title: 'Open Profile',
    body: 'Navigate to any LinkedIn profile in Chrome. Aletheia reads the page context — role, company, tenure, skills — in real time.',
  },
  {
    num: '02',
    title: 'Analyze Intent',
    body: 'Choose your goal: networking, job inquiry, partnership, or custom. Aletheia finds unique hooks from the profile to make your message stand out.',
  },
  {
    num: '03',
    title: 'Refine & Send',
    body: 'Review the AI-generated message, tweak the tone if needed, copy it, and send with confidence. You are always in control.',
  },
]

const MockupCard = () => (
  <div
    style={{
      width: '100%',
      maxWidth: 420,
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '1px',
      padding: '1.75rem',
      animation: 'float 6s ease-in-out infinite',
    }}
  >
    {/* Chrome bar */}
    <div
      className="mb-5 flex items-center gap-2 px-3 py-2"
      style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1px' }}
    >
      <div className="h-2 w-2 rounded-full" style={{ background: '#ef4444' }} />
      <div className="h-2 w-2 rounded-full" style={{ background: '#f59e0b' }} />
      <div className="h-2 w-2 rounded-full" style={{ background: '#22c55e' }} />
      <div
        className="ml-2 h-4 flex-1 flex items-center px-2"
        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1px' }}
      >
        <span style={{ fontSize: '9px', color: '#64748b' }}>linkedin.com/in/sarah-chen</span>
      </div>
    </div>

    {/* Profile */}
    <div className="mb-5 flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-full flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #3b5fc0, #1e3a8a)' }}
      />
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>Sarah Chen</div>
        <div style={{ fontSize: '9px', color: '#64748b' }}>ML Engineer · Google DeepMind</div>
      </div>
    </div>

    {/* Intent selector */}
    <div className="mb-4">
      <p style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3b5fc0', marginBottom: '0.5rem' }}>
        Message Intent
      </p>
      <div className="flex gap-2 flex-wrap">
        {['Networking', 'Job Inquiry', 'Partnership'].map((t, i) => (
          <span
            key={t}
            style={{
              fontSize: '9px',
              fontWeight: 600,
              padding: '3px 10px',
              background: i === 0 ? '#2d4ba0' : 'rgba(255,255,255,0.05)',
              color: i === 0 ? '#fff' : '#64748b',
              borderRadius: '1px',
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>

    {/* Generated message */}
    <div
      className="p-3 mb-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1px' }}
    >
      <p style={{ fontSize: '10px', lineHeight: 1.6, color: '#94a3b8' }}>
        Hi Sarah — I came across your work on transformer efficiency at DeepMind.
        Your paper on sparse attention was genuinely fascinating...
      </p>
    </div>

    <div className="flex gap-2">
      <button
        style={{
          flex: 1,
          padding: '8px',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          background: '#2d4ba0',
          color: '#fff',
          borderRadius: '1px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Copy Message
      </button>
      <button
        style={{
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 700,
          background: 'rgba(255,255,255,0.05)',
          color: '#64748b',
          borderRadius: '1px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        ↺
      </button>
    </div>
  </div>
)

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden py-28 px-8"
      style={{ background: '#0f172a' }}
    >
      <div className="mx-auto max-w-7xl">
        {/* On desktop: 2-col grid. On mobile: stacked (steps first, mockup below) */}
        <div className="grid gap-16 md:grid-cols-2 md:items-start">

          {/* Left: heading + steps */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7 }}
            >
              <span
                className="section-label mb-6 block"
                style={{
                  color: '#3b5fc0',
                  borderColor: 'rgba(59,95,192,0.35)',
                  background: 'rgba(59,95,192,0.08)',
                }}
              >
                The Process
              </span>
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontWeight: 900,
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  lineHeight: 1.1,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                }}
              >
                The Workflow{' '}
                <em style={{ fontStyle: 'italic', color: '#93c5fd' }}>Simplified.</em>
              </h2>
            </motion.div>

            <div className="mt-14 flex flex-col">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  className="relative flex gap-8 pb-12"
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Vertical line connector */}
                  {i < steps.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 27,
                        top: 50,
                        bottom: 0,
                        width: '1px',
                        background: 'rgba(255,255,255,0.08)',
                      }}
                    />
                  )}

                  {/* Step number */}
                  <div style={{ flexShrink: 0, width: 54 }}>
                    <span
                      style={{
                        fontFamily: 'Playfair Display, serif',
                        fontSize: '2.8rem',
                        fontWeight: 900,
                        color: 'rgba(255,255,255,0.1)',
                        lineHeight: 1,
                        fontStyle: 'italic',
                        display: 'block',
                      }}
                    >
                      {step.num}
                    </span>
                  </div>

                  <div>
                    <h3
                      style={{
                        marginBottom: '0.6rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: '#93c5fd',
                      }}
                    >
                      {step.title}
                    </h3>
                    <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#94a3b8' }}>
                      {step.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right: UI mockup — P1 fix: visible on ALL screen sizes, stacks below steps on mobile */}
          <motion.div
            className="flex items-start justify-center md:justify-end"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <MockupCard />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
