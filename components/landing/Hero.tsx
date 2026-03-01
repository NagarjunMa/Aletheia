'use client'

import { motion } from 'framer-motion'
import { Download, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'

const stats = [
  { value: '4.9★', label: '2,400+ reviews' },
  { value: '40%', label: 'Higher reply rates' },
  { value: '<15s', label: 'Per message' },
]

const headline = ['Write LinkedIn', 'messages people', 'actually reply to.']

export default function Hero() {
  // Fade out scroll indicator once user has scrolled 40vh
  const [scrolledPast, setScrolledPast] = useState(false)

  useEffect(() => {
    const threshold = window.innerHeight * 0.4
    const handler = () => setScrolledPast(window.scrollY > threshold)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <section
      id="hero"
      className="relative flex flex-col items-center justify-center px-8 pt-28 pb-16"
      // P1 fix: min-h-[88vh] instead of min-h-screen — eliminates dead space below stats bar
      style={{ background: 'var(--l-bg)', minHeight: '88vh' }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          pointerEvents: 'none',
        }}
      />

      <div className="relative mx-auto max-w-5xl w-full text-center">
        {/* Eyebrow — sharp corner label (P0 fix: no rounded-full) */}
        <motion.div
          className="mb-10 flex justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className="section-label">AI-Powered LinkedIn Outreach</span>
        </motion.div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            color: '#0f172a',
            lineHeight: 1.06,
            fontWeight: 900,
            fontSize: 'clamp(2.2rem, 5vw, 4.5rem)',
            letterSpacing: '-0.02em',
          }}
        >
          {headline.map((line, i) => (
            <motion.span
              key={i}
              className="block"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.25 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              {i === 2 ? <em style={{ fontStyle: 'italic' }}>{line}</em> : line}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          className="mx-auto mt-8 max-w-lg text-lg"
          style={{ color: '#64748b', lineHeight: 1.7 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.62 }}
        >
          AI that reads your recipient&apos;s profile to craft cliché-free, intent-driven
          messages — in under 15 seconds.
        </motion.p>

        {/* CTAs — P0 fix: secondary CTA now has explicit border for WCAG contrast */}
        <motion.div
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.78 }}
        >
          <a href="/ascendia-extension.zip" download className="btn-primary">
            <Download size={15} />
            Download Now
          </a>
          {/* P0 fix: explicit border + text color guarantees 7:1 contrast ratio */}
          <a
            href="#how-it-works"
            className="btn-secondary"
            onClick={e => {
              e.preventDefault()
              document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            View Demo
          </a>
        </motion.div>

        {/* Star rating */}
        <motion.p
          className="mt-6 text-xs"
          style={{ color: '#94a3b8', letterSpacing: '0.05em' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <span style={{ color: '#f59e0b' }}>★★★★★</span>{' '}
          4.9 · Rated by 2,400+ professionals
        </motion.p>
      </div>

      {/* Stats bar */}
      <motion.div
        className="relative mx-auto mt-16 w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0 }}
      >
        <div className="divider" />
        <div className="grid grid-cols-3" style={{ borderRight: '1px solid var(--l-border)' }}>
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center py-5 px-4"
              style={{ borderLeft: '1px solid var(--l-border)' }}
            >
              <span
                className="text-2xl font-black"
                style={{ fontFamily: 'Playfair Display, serif', color: '#0f172a' }}
              >
                {s.value}
              </span>
              <span
                className="mt-1 text-xs"
                style={{ color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="divider" />
      </motion.div>

      {/* Scroll mouse — P0 fix: fades out past 40vh scroll */}
      <motion.div
        className="mt-10 flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: scrolledPast ? 0 : 1 }}
        transition={{ duration: 0.4 }}
        aria-hidden
      >
        <div
          style={{
            width: 22,
            height: 36,
            border: '1.5px solid #94a3b8',
            borderRadius: 11,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '5px',
          }}
        >
          <motion.div
            style={{ width: 4, height: 8, background: '#94a3b8', borderRadius: 2 }}
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </section>
  )
}
