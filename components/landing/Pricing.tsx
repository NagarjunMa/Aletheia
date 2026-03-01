'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'

const tiers = [
    {
        name: 'Free',
        monthlyPrice: 0,
        annualPrice: 0,
        period: '/mo',
        description: 'For casual networkers who send occasionally.',
        cta: 'Get Started',
        ctaHref: '/ascendia-extension.zip',
        download: true,
        highlighted: false,
        features: [
            '30 messages / day',
            'Basic AI generation',
            'LinkedIn integration',
        ],
    },
    {
        name: 'Pro',
        monthlyPrice: 19,
        annualPrice: 15,
        period: '/mo',
        description: 'For active professionals who send daily.',
        cta: 'Get Pro',
        ctaHref: '#',
        download: false,
        highlighted: true,
        badge: 'MOST POPULAR',
        features: [
            'Unlimited messages',
            'Resume grounding',
            'Priority support',
            'Advanced analytics',
        ],
    },
    {
        name: 'Team',
        monthlyPrice: null,
        annualPrice: null,
        period: '',
        description: 'For recruiting teams and agencies at scale.',
        cta: 'Contact Sales',
        ctaHref: 'mailto:hello@aletheia.ai',
        download: false,
        highlighted: false,
        features: [
            'Everything in Pro',
            'Team dashboard',
            'Custom AI personas',
            'SLA + dedicated support',
        ],
    },
]

export default function Pricing() {
    const [annual, setAnnual] = useState(false)

    return (
        <section id="pricing" className="relative py-28 px-8" style={{ background: 'var(--l-bg)' }}>
            <div className="divider" />

            <div className="mx-auto max-w-7xl pt-20">
                {/* Header */}
                <motion.div
                    className="mb-14 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="section-label mb-5 block mx-auto" style={{ width: 'fit-content' }}>
                        Pricing
                    </span>
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
                        Simple Pricing
                    </h2>

                    {/* P2: Annual/Monthly toggle */}
                    <div className="mt-6 flex items-center justify-center gap-4">
                        <span
                            className="text-xs font-bold tracking-widest uppercase"
                            style={{ color: annual ? '#94a3b8' : '#0f172a' }}
                        >
                            Monthly
                        </span>
                        <button
                            onClick={() => setAnnual(!annual)}
                            role="switch"
                            aria-checked={annual}
                            className="relative cursor-pointer transition-colors duration-200"
                            style={{
                                width: 44,
                                height: 24,
                                background: annual ? '#2d4ba0' : '#e2e8f0',
                                borderRadius: 0,
                                border: '1.5px solid rgba(15,23,42,0.15)',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <motion.span
                                animate={{ x: annual ? 22 : 2 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                style={{
                                    display: 'block',
                                    width: 16,
                                    height: 16,
                                    background: annual ? '#fff' : '#94a3b8',
                                }}
                            />
                        </button>
                        <span
                            className="text-xs font-bold tracking-widest uppercase"
                            style={{ color: annual ? '#0f172a' : '#94a3b8' }}
                        >
                            Annual
                            {annual && (
                                <span
                                    className="ml-2 px-2 py-0.5 text-white"
                                    style={{
                                        background: '#2d4ba0',
                                        fontSize: '0.6rem',
                                        letterSpacing: '0.1em',
                                    }}
                                >
                                    SAVE 20%
                                </span>
                            )}
                        </span>
                    </div>
                </motion.div>

                {/* Pricing cards */}
                <div className="grid gap-px md:grid-cols-3" style={{ background: 'var(--l-border)' }}>
                    {tiers.map((tier, i) => {
                        const displayPrice =
                            tier.monthlyPrice === null
                                ? 'Custom'
                                : tier.monthlyPrice === 0
                                    ? '$0'
                                    : annual
                                        ? `$${tier.annualPrice}`
                                        : `$${tier.monthlyPrice}`

                        return (
                            <motion.div
                                key={tier.name}
                                className="relative flex flex-col p-10"
                                style={{ background: tier.highlighted ? '#0f172a' : 'var(--l-surface)' }}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-60px' }}
                                transition={{ duration: 0.65, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {/* Badge */}
                                {tier.badge && (
                                    <div className="mb-4">
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                padding: '3px 10px',
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.18em',
                                                textTransform: 'uppercase',
                                                background: '#2d4ba0',
                                                color: '#fff',
                                            }}
                                        >
                                            {tier.badge}
                                        </span>
                                    </div>
                                )}

                                {/* Tier name */}
                                <p
                                    style={{
                                        marginBottom: '0.25rem',
                                        fontSize: '0.6rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.2em',
                                        textTransform: 'uppercase',
                                        color: tier.highlighted ? '#3b5fc0' : '#94a3b8',
                                    }}
                                >
                                    {tier.name}
                                </p>

                                {/* Price */}
                                <div className="flex items-end gap-1 mb-5">
                                    <motion.span
                                        key={`${tier.name}-${annual}`}
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        style={{
                                            fontFamily: 'Playfair Display, serif',
                                            fontSize: '3.2rem',
                                            fontWeight: 900,
                                            lineHeight: 1,
                                            color: tier.highlighted ? '#ffffff' : '#0f172a',
                                            fontStyle: 'italic',
                                        }}
                                    >
                                        {displayPrice}
                                    </motion.span>
                                    {tier.period && tier.monthlyPrice !== 0 && tier.monthlyPrice !== null && (
                                        <span className="mb-2 text-xs" style={{ color: '#64748b' }}>
                                            {tier.period}
                                        </span>
                                    )}
                                    {tier.monthlyPrice === 0 && (
                                        <span className="mb-2 text-xs" style={{ color: '#64748b' }}>
                                            /forever
                                        </span>
                                    )}
                                </div>

                                <p className="mb-8 text-sm" style={{ color: tier.highlighted ? '#94a3b8' : '#64748b' }}>
                                    {tier.description}
                                </p>

                                {/* Feature list */}
                                <ul className="mb-10 flex flex-col gap-3 flex-1">
                                    {tier.features.map(f => (
                                        <li
                                            key={f}
                                            className="flex items-center gap-2.5 text-sm"
                                            style={{ color: tier.highlighted ? '#cbd5e1' : '#475569' }}
                                        >
                                            <span style={{ color: tier.highlighted ? '#3b5fc0' : '#2d4ba0', fontWeight: 900, fontSize: '0.9rem' }}>·</span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <a
                                    href={tier.ctaHref}
                                    download={tier.download || undefined}
                                    className="flex items-center justify-center gap-2 py-3.5 transition-all duration-200 cursor-pointer"
                                    style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.15em',
                                        textTransform: 'uppercase',
                                        textDecoration: 'none',
                                        background: tier.highlighted ? '#2d4ba0' : 'transparent',
                                        color: tier.highlighted ? '#ffffff' : '#0f172a',
                                        border: tier.highlighted ? '2px solid #2d4ba0' : '2px solid #0f172a',
                                        borderRadius: 'var(--l-radius, 0)',
                                    }}
                                    onMouseEnter={e => {
                                        if (!tier.highlighted) {
                                            e.currentTarget.style.background = '#0f172a'
                                            e.currentTarget.style.color = '#fff'
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!tier.highlighted) {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.color = '#0f172a'
                                        }
                                    }}
                                >
                                    {tier.download && <Download size={12} />}
                                    {tier.cta}
                                </a>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
