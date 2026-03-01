'use client'

import { motion } from 'framer-motion'
import { MessageSquare, User, Zap } from 'lucide-react'

const features = [
  {
    icon: MessageSquare,
    title: 'Resume Grounded',
    body: 'Our AI analyzes the recipient\'s profile — job titles, company tenure, skills, and activity — to pull relevant context into every message. Nothing generic, ever.',
    tag: '01',
  },
  {
    icon: User,
    title: 'Cliché-Free AI',
    body: 'We actively strip "AI-sounding" phrases, hollow openers, and filler words. Every message reads like it was written by a thoughtful human who did their homework.',
    tag: '02',
  },
  {
    icon: Zap,
    title: 'Intent Detection',
    body: 'Tell Aletheia your goal — networking, job inquiry, partnership, or custom — and it shapes the entire message around that intent without losing your voice.',
    tag: '03',
  },
]

export default function Features() {
  return (
    <section id="features" className="relative py-32 px-8" style={{ background: 'var(--l-bg)' }}>
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-24">
        {/* Header */}
        <div className="mb-20 grid md:grid-cols-2 gap-12 items-end">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="section-label mb-5 block">Why Aletheia</span>
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
              Redefining the art of{' '}
              <em style={{ fontStyle: 'italic' }}>professional connection.</em>
            </h2>
          </motion.div>

          <motion.p
            className="text-base leading-relaxed"
            style={{ color: '#64748b' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            Most AI tools churn out generic copy. Aletheia is built differently — grounded
            in the person you&apos;re reaching out to, and tuned to say exactly what you mean.
          </motion.p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-px md:grid-cols-3" style={{ background: 'var(--l-border)' }}>
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.tag}
                className="relative flex flex-col p-10"
                style={{ background: 'var(--l-surface)' }}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.65, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Tag number */}
                <span
                  className="absolute top-8 right-8 text-xs font-bold tracking-widest"
                  style={{ color: '#e2e8f0' }}
                >
                  {feature.tag}
                </span>

                {/* Icon */}
                <div
                  className="mb-7 flex h-11 w-11 items-center justify-center"
                  style={{ background: 'rgba(45,75,160,0.08)', border: '1px solid rgba(45,75,160,0.15)' }}
                >
                  <Icon size={20} style={{ color: '#2d4ba0' }} />
                </div>

                {/* Title */}
                <h3
                  className="mb-4 text-xs font-bold tracking-widest uppercase"
                  style={{ color: '#0f172a' }}
                >
                  {feature.title}
                </h3>

                {/* Body */}
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                  {feature.body}
                </p>

                {/* Learn more */}
                <button
                  className="mt-auto pt-8 self-start text-xs font-bold tracking-widest uppercase transition-colors duration-150 cursor-pointer"
                  style={{ color: '#2d4ba0' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#2d4ba0')}
                >
                  Learn More →
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
