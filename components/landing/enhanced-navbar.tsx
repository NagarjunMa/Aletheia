'use client'

// Enhanced Navbar with Scroll-based Backdrop Blur
// Following Rule 2: Layout-stable Framer Motion animations

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'

interface EnhancedNavbarProps {
  className?: string
}

export function EnhancedNavbar({ className }: EnhancedNavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Optimized scroll handler with useCallback to prevent re-renders
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 50)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Close mobile menu when clicking nav items
  const handleNavClick = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <motion.nav
      layout // Rule 2: Prevents layout shift
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/80 backdrop-blur-xl py-4 border-b border-white/10'
          : 'bg-transparent py-8'
      } ${className}`}
      initial={false} // Prevent initial animation flash
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <motion.div
          layoutId="logo" // Shared element animation
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
          style={{ willChange: 'transform' }} // GPU acceleration
        >
          <div className="w-6 h-6 bg-ascendia-accent rounded-lg flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <span className="text-xl font-bold tracking-tighter text-white">ASCENDIA</span>
        </motion.div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-12 text-sm font-medium tracking-widest uppercase">
          {['Philosophy', 'Process', 'Use Cases'].map((item, index) => (
            <motion.a
              key={item}
              href={`#${item.toLowerCase().replace(' ', '-')}`}
              whileHover={{
                color: '#2e5797',
                y: -1,
                transition: { duration: 0.2 }
              }}
              className="text-white/50 hover:text-white transition-all duration-300"
              style={{ willChange: 'transform, color' }}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
            >
              {item}
            </motion.a>
          ))}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Link href="/auth/register">
              <motion.button
                whileHover={{
                  scale: 1.05,
                  backgroundColor: '#2e5797',
                  color: '#fff',
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-2.5 border border-white/20 text-white rounded-full font-bold transition-all duration-300 shadow-xl"
                style={{ willChange: 'transform' }}
              >
                Get Started
              </motion.button>
            </Link>
          </motion.div>
        </div>

        {/* Mobile Menu Toggle */}
        <motion.button
          className="md:hidden text-white p-2"
          onClick={() => setIsOpen(!isOpen)}
          whileTap={{ scale: 0.95 }}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isOpen ? 'close' : 'open'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-2xl border-b border-white/10 overflow-hidden"
            style={{ willChange: 'height, opacity' }}
          >
            <motion.div
              className="p-8 flex flex-col gap-8"
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.a
                href="#philosophy"
                className="text-2xl font-bold text-white hover:text-ascendia-accent transition-colors"
                onClick={handleNavClick}
                whileHover={{ x: 10, transition: { duration: 0.2 } }}
              >
                Philosophy
              </motion.a>
              <motion.a
                href="#process"
                className="text-2xl font-bold text-white hover:text-ascendia-accent transition-colors"
                onClick={handleNavClick}
                whileHover={{ x: 10, transition: { duration: 0.2 } }}
              >
                Process
              </motion.a>
              <motion.a
                href="#use-cases"
                className="text-2xl font-bold text-white hover:text-ascendia-accent transition-colors"
                onClick={handleNavClick}
                whileHover={{ x: 10, transition: { duration: 0.2 } }}
              >
                Use Cases
              </motion.a>
              <Link href="/auth/register" onClick={handleNavClick}>
                <motion.button
                  className="w-full py-4 bg-ascendia-accent text-white rounded-full font-black uppercase tracking-widest hover:bg-ascendia-accent-dim transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get Started
                </motion.button>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}