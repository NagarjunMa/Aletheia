'use client'

import { motion } from 'framer-motion'

/**
 * FloatingSidebar — Fixed left-edge vertical badge.
 * Wibify equivalent: their "W. Nominee" sidebar element.
 * Shows "A." at top and "BETA" vertically. Only on xl+ screens.
 */
export default function FloatingSidebar() {
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
                position: 'fixed',
                left: '1.25rem',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                pointerEvents: 'none',
            }}
            className="hidden xl:flex"
            aria-hidden="true"
        >
            {/* Logo mark */}
            <span
                style={{
                    fontFamily: 'var(--font-cormorant), Playfair Display, Georgia, serif',
                    fontWeight: 300,
                    fontSize: '1.1rem',
                    color: 'rgba(142, 182, 155, 0.6)',
                    letterSpacing: '0.02em',
                }}
            >
                A.
            </span>

            {/* Vertical line */}
            <div
                style={{
                    width: '1px',
                    height: '40px',
                    background: 'rgba(142, 182, 155, 0.2)',
                }}
            />

            {/* BETA text — vertical */}
            <span
                style={{
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    fontSize: '0.52rem',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'rgba(142, 182, 155, 0.45)',
                }}
            >
                Beta
            </span>
        </motion.div>
    )
}
