'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import AuroraBackground from '@/components/AuroraBackground'

const features = [
  { symbol: '◈', text: '42-word negative lexicon strips AI phrases' },
  { symbol: '◉', text: '21-pattern fingerprint detector humanises tone' },
  { symbol: '◊', text: '0–100 authenticity score before you see the draft' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#000000', fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Aurora shards — shared with landing page */}
      <AuroraBackground />

      {/* ── Left: form panel ─────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-16 relative z-10 overflow-hidden">
        {/* Micro dot grid texture */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(218,241,222,0.05) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
          }}
        />
        {/* Vignette to focus attention on form */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.70) 100%)',
            pointerEvents: 'none',
          }}
        />
        <div className="relative z-10 w-full max-w-[420px]">
          {children}
        </div>
      </div>

      {/* ── Right: branding panel ─────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative z-10 overflow-hidden items-center justify-center"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Watermark */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <span style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '28rem',
            fontWeight: 900,
            color: 'rgba(218,241,222,0.025)',
            lineHeight: 1,
            fontStyle: 'italic',
          }}>A</span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md px-12">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-3 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <Image src="/Aletheia.svg" alt="Aletheia" width={28} height={28} />
            <span style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 400,
              fontSize: '1.25rem',
              color: '#DAF1DE',
              letterSpacing: '0.06em',
            }}>
              Aletheia
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h2
            style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 900,
              fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
              lineHeight: 1.08,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              marginBottom: '1.25rem',
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
          >
            LinkedIn outreach that sounds{' '}
            <em style={{ fontStyle: 'italic', color: '#DAF1DE' }}>human.</em>
          </motion.h2>

          {/* Subtext */}
          <motion.p
            style={{ color: 'rgba(218,241,222,0.5)', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '2.5rem' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Profile-grounded generation, negative lexicon filtering, and authenticity scoring — before you hit send.
          </motion.p>

          {/* Feature bullets */}
          <motion.div
            style={{ borderTop: '1px solid rgba(218,241,222,0.08)', paddingTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.55 + i * 0.1 }}
              >
                <span style={{ color: '#DAF1DE', fontSize: '0.7rem', marginTop: '2px', flexShrink: 0 }}>{f.symbol}</span>
                <span style={{ color: 'rgba(218,241,222,0.50)', fontSize: '0.8rem', lineHeight: 1.6 }}>{f.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="glass-aurora"
            style={{ marginTop: '2.5rem', padding: '1.25rem' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75 }}
          >
            <p style={{ fontSize: '0.7rem', color: 'rgba(218,241,222,0.30)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Beta Access</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(218,241,222,0.60)', lineHeight: 1.6, fontStyle: 'italic' }}>
              &ldquo;This is the first tool where my recipients stopped asking if I used AI.&rdquo;
            </p>
            <p style={{ fontSize: '0.7rem', color: 'rgba(218,241,222,0.30)', marginTop: '0.5rem', letterSpacing: '0.06em' }}>— Beta Tester · Senior Account Executive</p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
