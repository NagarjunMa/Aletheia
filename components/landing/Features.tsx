'use client'

import { motion } from 'framer-motion'
import { MessageSquare, User, Zap } from 'lucide-react'

const features = [
  {
    icon: MessageSquare,
    title: 'Profile-Grounded Generation',
    body: 'The extension reads the recipient\'s LinkedIn page — name, headline, job history, recent posts, skills — and passes it to Claude Sonnet 4. The AI only references what exists on their profile and in your resume. If your resume is empty, it focuses on curiosity about their work instead of inventing your background. No hallucinated credentials, no fabricated metrics.',
    tag: '01',
  },
  {
    icon: User,
    title: '42-Word Negative Lexicon + 21 AI Fingerprint Patterns',
    body: 'Every message runs through two sanitization layers. First: a negative lexicon strips phrases like "delve," "leverage," "I came across your profile," and "passionate about." Second: a fingerprint detector catches subtler tells — em-dashes converted to hyphens, "would you be open to" replaced with casual variants, corporate buzzwords swapped for conversational equivalents. Each message gets a 0-100 authenticity score measuring sentence variation, informality, and pronoun patterns.',
    tag: '02',
  },
  {
    icon: Zap,
    title: 'Intent-Driven Structure with Platform Constraints',
    body: 'Choose from 4 intents — networking, referral, mentorship, or job inquiry — and 3 formats. LinkedIn connections follow a strict Acknowledgment, Intro, CTA structure within 270 characters. Cold emails cap at 150 words across 6-8 sentences. InMails cap at 120 words. Each format enforces its own structural rules so nothing reads like a template.',
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
            <span className="section-label mb-5 block">The Technical Reality</span>
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 900,
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                lineHeight: 1.08,
                color: 'var(--l-text)',
                letterSpacing: '-0.02em',
              }}
            >
              What happens between{' '}
              <em style={{ fontStyle: 'italic' }}>click and clipboard.</em>
            </h2>
          </motion.div>

          <motion.p
            className="text-base leading-relaxed"
            style={{ color: 'var(--l-text-muted)' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            Every AI outreach tool claims to be &quot;personalized.&quot; Here is what Aletheia actually does: it reads the profile, refuses to invent anything not in your resume, strips 42 known AI clich&eacute;s, detects and humanizes 21 fingerprint patterns, and scores the result for authenticity before you see it.
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
                whileHover={{ y: -4 }}
              >
                {/* Tag number */}
                <span
                  className="absolute top-8 right-8 text-xs font-bold tracking-widest"
                  style={{ color: 'rgba(142,182,155,0.15)' }}
                >
                  {feature.tag}
                </span>

                {/* Icon */}
                <div
                  className="mb-7 flex h-11 w-11 items-center justify-center"
                  style={{ background: 'rgba(142,182,155,0.08)', border: '1px solid rgba(142,182,155,0.15)' }}
                >
                  <Icon size={20} style={{ color: 'var(--l-blue)' }} />
                </div>

                {/* Title */}
                <h3
                  className="mb-4 text-xs font-bold tracking-widest uppercase"
                  style={{ color: 'var(--l-text)' }}
                >
                  {feature.title}
                </h3>

                {/* Body */}
                <p className="text-sm leading-relaxed" style={{ color: 'var(--l-text-muted)' }}>
                  {feature.body}
                </p>

                {/* Learn more */}
                <button
                  className="mt-auto pt-8 self-start text-xs font-bold tracking-widest uppercase transition-colors duration-150 cursor-pointer"
                  style={{ color: 'var(--l-blue)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--l-text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--l-blue)')}
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
