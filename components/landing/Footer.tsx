'use client'

import Image from 'next/image'

const footerLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Process', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export default function Footer() {
  const scrollTo = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="relative px-8 py-12" style={{ background: 'var(--l-bg)' }}>
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <Image src="/Aletheia.svg" alt="Aletheia" width={18} height={18} />
            <span
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 800,
                fontSize: '0.8rem',
                color: '#0f172a',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              Aletheia
            </span>
          </button>

          {/* Nav links */}
          <nav className="flex flex-wrap gap-8">
            {footerLinks.map(link => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="cursor-pointer text-[10px] font-bold tracking-widest uppercase transition-colors duration-150"
                style={{ color: '#94a3b8' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-[10px] tracking-widest uppercase" style={{ color: '#cbd5e1' }}>
            © {new Date().getFullYear()} Aletheia
          </p>
        </div>
      </div>
    </footer>
  )
}
