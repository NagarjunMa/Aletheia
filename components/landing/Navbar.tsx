'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Process', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
]

/* ── Animated Sun / Moon toggle ───────────────────────── */
function ThemeToggle() {
  const { isDark, toggle } = useTheme()

  return (
    <motion.button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="landing-toggle-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        border: '1px solid var(--l-border)',
        background: 'var(--l-surface)',
        padding: '0.35rem 0.75rem',
        cursor: 'pointer',
        borderRadius: '0',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Track */}
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          width: '28px',
          height: '16px',
          background: 'var(--l-border)',
          borderRadius: '0',
          flexShrink: 0,
        }}
      >
        {/* Knob */}
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            position: 'absolute',
            top: '2px',
            left: isDark ? '2px' : '12px',
            width: '12px',
            height: '12px',
            background: 'var(--l-text)',
            borderRadius: '0',
          }}
        />
      </span>

      {/* Icon — sun or moon, purely CSS color */}
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.svg
            key="moon"
            initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
            transition={{ duration: 0.22 }}
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="var(--l-text-muted)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            initial={{ opacity: 0, rotate: 30, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -30, scale: 0.7 }}
            transition={{ duration: 0.22 }}
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="var(--l-text-muted)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sections = navLinks.map(l => document.querySelector(l.href)) as HTMLElement[]
    if (sections.every(s => !s)) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      { threshold: [0.2, 0.5], rootMargin: '-60px 0px -30% 0px' }
    )

    sections.forEach(s => s && observer.observe(s))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const scrollTo = (href: string) => {
    setMobileOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    /* ↓ All bg/color theming is CSS-driven via .landing-navbar classes in globals.css */
    <header
      className={`landing-navbar fixed top-0 left-0 right-0 z-50 ${scrolled ? 'scrolled' : ''}`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        {/* Logo — color driven by .landing-nav-logo CSS class */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <Image src="/Aletheia.svg" alt="Aletheia" width={22} height={22} />
          <span
            className="landing-nav-logo"
            style={{
              fontFamily: 'var(--font-cormorant), Georgia, serif',
              fontWeight: 300,
              fontSize: '1.35rem',
              letterSpacing: '0.04em',
            }}
          >
            Aletheia
          </span>
        </button>

        {/* Desktop Nav — colors via .landing-nav-link */}
        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => {
            const sectionId = link.href.replace('#', '')
            const isActive = activeSection === sectionId
            return (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className={`landing-nav-link relative cursor-pointer ${isActive ? 'active' : ''}`}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  paddingBottom: '2px',
                }}
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-line"
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      left: 0,
                      right: 0,
                      height: '1.5px',
                      background: 'var(--l-blue)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Right side: theme toggle + CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/ascendia-extension.zip"
            download
            className="btn-primary"
            style={{ fontSize: '0.68rem', padding: '0.65rem 1.4rem' }}
          >
            Get Extension
          </a>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="landing-menu-icon cursor-pointer p-1"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu — bg via .landing-mobile-menu CSS class */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="landing-mobile-menu md:hidden px-8 pb-6 pt-2"
          >
            {navLinks.map(link => {
              const sectionId = link.href.replace('#', '')
              const isActive = activeSection === sectionId
              return (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className={`landing-nav-link block w-full py-3.5 text-left cursor-pointer ${isActive ? 'active' : ''}`}
                  style={{
                    fontWeight: isActive ? 800 : 700,
                    fontSize: '0.68rem',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--l-border)',
                  }}
                >
                  {isActive && <span style={{ color: 'var(--l-blue)', marginRight: '0.5rem' }}>·</span>}
                  {link.label}
                </button>
              )
            })}
            <div className="mt-5">
              <a href="/ascendia-extension.zip" download className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                Get Extension
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
