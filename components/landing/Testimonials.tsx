'use client'

import { motion } from 'framer-motion'

const testimonials = [
    {
        quote:
            'I used to manually edit out "I hope this message finds you well" and "I was impressed by your background" from every AI draft. Aletheia strips those before I even see the output. My recipients can spot AI in the first sentence — this is the first tool where they stopped asking if I used one.',
        name: 'Beta Tester',
        role: 'Senior Account Executive',
        company: 'SaaS',
        initials: 'BT',
        color: '#235347',
    },
    {
        quote:
            'The profile grounding is what sold me. It pulled the candidate\'s actual job title and a recent post about distributed systems into a 270-character connection request that fit naturally. No more "I came across your impressive profile" openers that get ignored.',
        name: 'Beta Tester',
        role: 'Technical Recruiter',
        company: 'Enterprise Tech',
        initials: 'BT',
        color: '#163832',
    },
    {
        quote:
            'After I accepted 3 messages, the next batch started matching my writing style — shorter sentences, more direct questions, fewer adjectives. It learned what works for me instead of guessing.',
        name: 'Beta Tester',
        role: 'Founder',
        company: 'Early-Stage Startup',
        initials: 'BT',
        color: '#8EB69B',
    },
]

export default function Testimonials() {
    return (
        <section className="relative py-28 px-8" style={{ background: 'var(--l-bg-alt, #f4f6fb)' }}>
            <div className="divider" />

            <div className="mx-auto max-w-7xl pt-20">
                {/* Header */}
                <div className="mb-16 grid md:grid-cols-2 gap-8 items-end">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-60px' }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="section-label mb-5 block">Beta Feedback</span>
                        <h2
                            style={{
                                fontFamily: 'Playfair Display, serif',
                                fontWeight: 900,
                                fontSize: 'clamp(1.9rem, 4vw, 2.8rem)',
                                lineHeight: 1.1,
                                color: 'var(--l-text)',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            From early testers,{' '}
                            <em style={{ fontStyle: 'italic' }}>unfiltered.</em>
                        </h2>
                    </motion.div>

                    <motion.p
                        className="text-sm leading-relaxed"
                        style={{ color: 'var(--l-text-muted)' }}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        Aletheia is in beta. These responses reflect the actual capabilities users encounter — profile grounding, negative lexicon filtering, and adaptive learning from accepted messages.
                    </motion.p>
                </div>

                {/* Cards — 3-col on desktop, single-col on mobile */}
                <div className="grid gap-px md:grid-cols-3" style={{ background: 'var(--l-border)' }}>
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={i}
                            className="relative flex flex-col p-10"
                            style={{ background: 'var(--l-surface)' }}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-60px' }}
                            transition={{ duration: 0.65, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {/* Opening quote mark */}
                            <span
                                style={{
                                    fontFamily: 'Playfair Display, serif',
                                    fontSize: '3.5rem',
                                    lineHeight: 1,
                                    color: 'rgba(142,182,155,0.20)',
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 900,
                                }}
                            >
                                &ldquo;
                            </span>

                            {/* Quote */}
                            <p
                                className="flex-1 text-sm leading-relaxed mb-8"
                                style={{ color: 'var(--l-text)', fontStyle: 'italic' }}
                            >
                                {t.quote}
                            </p>

                            {/* Attribution */}
                            <div className="flex items-center gap-3">
                                {/* Initials avatar */}
                                <div
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-white"
                                    style={{
                                        background: t.color,
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    {t.initials}
                                </div>
                                <div>
                                    <div
                                        className="text-xs font-bold"
                                        style={{ color: 'var(--l-text)', letterSpacing: '0.04em' }}
                                    >
                                        {t.name}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--l-text-muted)' }}>
                                        {t.role} · {t.company}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
