'use client'

import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { useState } from 'react'

export default function CTA() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

  return (
    <section className="relative py-32 px-8" style={{ background: 'var(--l-bg)' }}>
      <div className="divider" />

      <div className="mx-auto max-w-5xl pt-24">
        <motion.div
          className="grid md:grid-cols-2 gap-16 items-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <span className="section-label mb-6 block">Get Started</span>
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
              Join the{' '}
              <em style={{ fontStyle: 'italic' }}>waitlist.</em>
            </h2>
            <p className="mt-5 text-sm leading-relaxed" style={{ color: '#64748b', maxWidth: '42ch' }}>
              The Chrome Web Store version is coming soon. Drop your email to be first
              in line — or download the extension directly today.
            </p>

            <div className="mt-8">
              <a href="/ascendia-extension.zip" download className="btn-primary inline-flex items-center gap-2">
                <Download size={13} />
                Download Extension Now
              </a>
              <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>
                Free · 30 messages/day · No account required
              </p>
            </div>
          </div>

          {/* Email form */}
          <div
            className="p-10"
            style={{
              background: 'var(--l-surface)',
              border: '1px solid var(--l-border)',
            }}
          >
            {submitted ? (
              <div className="text-center">
                <div
                  className="mx-auto mb-5 flex h-12 w-12 items-center justify-center"
                  style={{ background: 'rgba(45,75,160,0.08)', border: '1px solid rgba(45,75,160,0.2)' }}
                >
                  <span style={{ color: '#2d4ba0', fontSize: '1.2rem' }}>✓</span>
                </div>
                <p className="text-sm font-bold tracking-widest uppercase" style={{ color: '#0f172a' }}>
                  You&apos;re on the list
                </p>
                <p className="mt-2 text-xs" style={{ color: '#94a3b8' }}>
                  We&apos;ll email you when the Chrome Web Store version launches.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-6 text-xs font-bold tracking-widest uppercase" style={{ color: '#0f172a' }}>
                  Notify me at launch
                </p>
                <form onSubmit={handleSubmit}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="mb-4 w-full bg-transparent px-4 py-3 text-sm outline-none"
                    style={{
                      border: '1px solid var(--l-border)',
                      color: '#0f172a',
                    }}
                  />
                  <button
                    type="submit"
                    className="btn-primary w-full justify-center"
                    style={{ width: '100%' }}
                  >
                    Notify Me
                  </button>
                  <p className="mt-3 text-center text-xs" style={{ color: '#94a3b8' }}>
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
