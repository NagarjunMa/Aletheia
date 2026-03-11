'use client'

/**
 * StatTicker — CSS infinite marquee of product truth statements.
 * Replaces the icon-only ticker that had visible gaps.
 * Each item is a short fact/stat about Aletheia with a small accent symbol.
 */

const stats = [
    { symbol: '◈', text: '42-word negative lexicon' },
    { symbol: '◉', text: 'AI fingerprint stripped before you see it' },
    { symbol: '◊', text: '0–100 authenticity score on every draft' },
    { symbol: '▲', text: 'Profile-grounded, not template-based' },
    { symbol: '◈', text: 'Chrome extension — no app switching' },
    { symbol: '◉', text: 'Adaptive to your writing style over time' },
    { symbol: '◊', text: 'Works on Free, Premium & Recruiter LinkedIn' },
    { symbol: '▲', text: 'Powered by Claude Sonnet — Anthropic' },
    { symbol: '◈', text: '30 free messages per day, no card required' },
    { symbol: '◉', text: 'Reads recipient\'s posts, skills & experience' },
    { symbol: '◊', text: 'Strips "delve", "leverage" & 40+ AI clichés' },
    { symbol: '▲', text: 'One click — copy-paste to LinkedIn' },
]

const StatSet = () => (
    <>
        {stats.map((s, i) => (
            <div
                key={i}
                className="flex items-center gap-2.5 px-10"
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
                <span style={{ color: 'var(--l-blue)', fontSize: '0.65rem', lineHeight: 1 }}>{s.symbol}</span>
                <span style={{
                    color: 'var(--l-text-dim)',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                }}>
                    {s.text}
                </span>
            </div>
        ))}
    </>
)

export default function LogoTicker() {
    return (
        <div
            style={{
                background: 'var(--l-bg-alt)',
                borderTop: '1px solid var(--l-border)',
                borderBottom: '1px solid var(--l-border)',
                padding: '1.1rem 0',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Fade edge left */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '100px',
                    background: 'linear-gradient(90deg, var(--l-bg-alt) 40%, transparent 100%)',
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />
            {/* Fade edge right */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '100px',
                    background: 'linear-gradient(270deg, var(--l-bg-alt) 40%, transparent 100%)',
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />

            {/* Scrolling track — 3 sets for robust infinite loop */}
            <div
                className="marquee-track"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: 'max-content',
                }}
            >
                <StatSet />
                <StatSet />
                <StatSet />
            </div>
        </div>
    )
}
