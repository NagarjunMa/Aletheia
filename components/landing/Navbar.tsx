'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Process', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('')

  // Scroll-frosted navbar + active section tracking via IntersectionObserver
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
        // Use the entry that is most visible (highest intersectionRatio)
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible.length > 0) setActiveSection(visible[0].target.id)
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
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(238,241,248,0.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(15,23,42,0.08)' : 'none',
      }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <Image src="/Aletheia.svg" alt="Aletheia" width={22} height={22} />
          <span
            style={{
              color: '#0f172a',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 800,
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Aletheia
          </span>
        </button>

        {/* Desktop Nav — with active section indicator */}
        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => {
            const sectionId = link.href.replace('#', '')
            const isActive = activeSection === sectionId
            return (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="relative cursor-pointer transition-colors duration-200"
                style={{
                  color: isActive ? '#0f172a' : '#64748b',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  paddingBottom: '2px',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#0f172a' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#64748b' }}
              >
                {link.label}
                {/* Active underline indicator */}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-line"
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      left: 0,
                      right: 0,
                      height: '1.5px',
                      background: '#2d4ba0',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* CTA — sharp corners matching Euveka design language */}
        <div className="hidden md:block">
          <a
            href="/ascendia-extension.zip"
            download
            className="btn-primary"
            style={{ fontSize: '0.68rem', padding: '0.65rem 1.4rem' }}
          >
            Get Extension
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden cursor-pointer p-1"
          aria-label="Toggle menu"
          style={{ color: '#0f172a' }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="md:hidden px-8 pb-6 pt-2"
            style={{ background: '#eef1f8', borderBottom: '1px solid rgba(15,23,42,0.08)' }}
          >
            {navLinks.map(link => {
              const sectionId = link.href.replace('#', '')
              const isActive = activeSection === sectionId
              return (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full py-3.5 text-left cursor-pointer transition-colors duration-150"
                  style={{
                    color: isActive ? '#0f172a' : '#64748b',
                    fontWeight: isActive ? 800 : 700,
                    fontSize: '0.68rem',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(15,23,42,0.06)',
                  }}
                >
                  {isActive && <span style={{ color: '#2d4ba0', marginRight: '0.5rem' }}>·</span>}
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
