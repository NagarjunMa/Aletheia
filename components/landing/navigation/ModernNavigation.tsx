'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationItem {
  label: string
  href: string
}

const navigationItems: NavigationItem[] = [
  { label: 'Features', href: '/features' },
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'About', href: '/about' },
  { label: 'Feedback', href: '/feedback' }
]

export function ModernNavigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { scrollY } = useScroll()

  // Transform values for scroll animations
  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ['rgba(10, 10, 10, 0)', 'rgba(10, 10, 10, 0.8)']
  )

  const borderOpacity = useTransform(
    scrollY,
    [0, 100],
    [0, 0.2]
  )

  useEffect(() => {
    const unsubscribe = scrollY.onChange(value => {
      setIsScrolled(value > 50)
    })
    return unsubscribe
  }, [scrollY])

  return (
    <motion.header
      style={{
        backgroundColor,
        borderBottomColor: useTransform(borderOpacity, opacity => `rgba(46, 87, 151, ${opacity})`)
      }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        "backdrop-blur-md border-b",
        isScrolled ? "shadow-lg shadow-black/10" : ""
      )}
    >
      <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative z-10"
        >
          <Link href="/">
            <Logo size="lg" />
          </Link>
        </motion.div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navigationItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.2 }}
            >
              <Link href={item.href}>
                <motion.span
                  className="text-foreground/80 hover:text-[#2e5797] transition-colors cursor-pointer relative group"
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                >
                  {item.label}
                  {/* Hover underline */}
                  <motion.div
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-[#2e5797] to-[#4a7bc8] origin-left"
                    initial={{ scaleX: 0 }}
                    whileHover={{ scaleX: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                </motion.span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="hidden md:block"
        >
          <Link href="/register">
            <motion.div
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 25px rgba(46, 87, 151, 0.4)"
              }}
              whileTap={{ scale: 0.95 }}
            >
              <Button className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300">
                Get Started
              </Button>
            </motion.div>
          </Link>
        </motion.div>

        {/* Mobile Menu Button */}
        <motion.button
          className="md:hidden relative z-10"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </motion.div>
        </motion.button>
      </nav>

      {/* Mobile Menu */}
      <motion.div
        className="md:hidden"
        initial={false}
        animate={{
          height: isMobileMenuOpen ? 'auto' : 0,
          opacity: isMobileMenuOpen ? 1 : 0
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-4 pb-4 space-y-4 bg-background/95 backdrop-blur-md border-t border-[#2e5797]/20">
          {navigationItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: isMobileMenuOpen ? 1 : 0,
                x: isMobileMenuOpen ? 0 : -20
              }}
              transition={{ delay: isMobileMenuOpen ? index * 0.1 : 0 }}
            >
              <Link
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <motion.div
                  className="py-3 px-4 text-foreground/80 hover:text-[#2e5797] hover:bg-[#2e5797]/10 rounded-lg transition-all duration-200"
                  whileTap={{ scale: 0.98 }}
                >
                  {item.label}
                </motion.div>
              </Link>
            </motion.div>
          ))}

          {/* Mobile CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: isMobileMenuOpen ? 1 : 0,
              y: isMobileMenuOpen ? 0 : 20
            }}
            transition={{ delay: isMobileMenuOpen ? 0.4 : 0 }}
            className="pt-4"
          >
            <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold">
                Get Started
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </motion.header>
  )
}