'use client'

import { motion } from 'framer-motion'

const testimonials = [
    {
        quote:
            'I went from a 12% reply rate to 38% in two weeks. Aletheia writes messages that sound like me — not like a robot trying to sound like me.',
        name: 'Marcus T.',
        role: 'Senior Account Executive',
        company: 'Salesforce',
        initials: 'MT',
        color: '#2d4ba0',
    },
    {
        quote:
            'As a recruiter, I send 80+ messages a week. Aletheia cut my writing time by 70% and candidates actually respond now. The profile reading is uncanny.',
        name: 'Priya K.',
        role: 'Technical Recruiter',
        company: 'Stripe',
        initials: 'PK',
        color: '#0f172a',
    },
    {
        quote:
            "Finally an AI tool that doesn't start every message with 'I came across your profile and was impressed.' Worth every cent.",
        name: 'James O.',
        role: 'Founder',
        company: 'Stealth Startup',
        initials: 'JO',
        color: '#1e3a8a',
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
                        <span className="section-label mb-5 block">Social Proof</span>
                        <h2
                            style={{
                                fontFamily: 'Playfair Display, serif',
                                fontWeight: 900,
                                fontSize: 'clamp(1.9rem, 4vw, 2.8rem)',
                                lineHeight: 1.1,
                                color: '#0f172a',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            What early users{' '}
                            <em style={{ fontStyle: 'italic' }}>are saying.</em>
                        </h2>
                    </motion.div>

                    <motion.p
                        className="text-sm leading-relaxed"
                        style={{ color: '#64748b' }}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        Aletheia is in private beta with a growing group of recruiters, founders,
                        and sales professionals. Here&apos;s what they&apos;re finding.
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
                                    color: 'rgba(45,75,160,0.15)',
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontWeight: 900,
                                }}
                            >
                                "
                            </span>

                            {/* Quote */}
                            <p
                                className="flex-1 text-sm leading-relaxed mb-8"
                                style={{ color: '#475569', fontStyle: 'italic' }}
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
                                        style={{ color: '#0f172a', letterSpacing: '0.04em' }}
                                    >
                                        {t.name}
                                    </div>
                                    <div className="text-xs" style={{ color: '#94a3b8' }}>
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
