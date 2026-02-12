'use client'

import React, { useRef, Suspense } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import dynamic from 'next/dynamic'
import { TypingDemo } from './TypingDemo'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

// Lazy load 3D components for better performance
const FloatingElements = dynamic(() => import('./FloatingElements'), {
  ssr: false,
  loading: () => <div className="absolute inset-0" />
})

export function AnimatedHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  // Parallax transforms
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95])

  return (
    <motion.section
      ref={containerRef}
      style={{ y, opacity, scale }}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Animated Background Layers */}
      <div className="absolute inset-0 -z-20">
        {/* Primary gradient background */}
        <motion.div
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, rgba(46, 87, 151, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(46, 87, 151, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(46, 87, 151, 0.15) 0%, transparent 50%)"
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full"
        />

        {/* Secondary gradient layer */}
        <motion.div
          animate={{
            background: [
              "radial-gradient(ellipse at top, rgba(26, 61, 107, 0.1) 0%, transparent 70%)",
              "radial-gradient(ellipse at bottom, rgba(26, 61, 107, 0.1) 0%, transparent 70%)",
              "radial-gradient(ellipse at top, rgba(26, 61, 107, 0.1) 0%, transparent 70%)"
            ]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute inset-0"
        />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.15] bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZUZpbHRlciI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZUZpbHRlcikiIG9wYWNpdHk9IjAuNCIvPjwvc3ZnPg==')]" />
      </div>

      {/* 3D Floating Elements */}
      <Suspense fallback={null}>
        <FloatingElements />
      </Suspense>

      {/* Main Content */}
      <div className="container mx-auto px-4 relative z-10 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-5xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-[#2e5797]/10 border border-[#2e5797]/20 rounded-full px-4 py-2 mb-8"
          >
            <Sparkles className="h-4 w-4 text-[#2e5797]" />
            <span className="text-sm font-medium text-[#2e5797]">
              AI-Powered Writing Assistant
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[1.1]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <span className="bg-gradient-to-r from-[#2e5797] via-[#4a7bc8] to-[#1a3d6b] bg-clip-text text-transparent">
              Your Voice,
            </span>
            <br />
            <span className="relative">
              <span className="bg-gradient-to-r from-[#4a7bc8] via-[#2e5797] to-[#1a3d6b] bg-clip-text text-transparent">
                Perfected
              </span>
              {/* Glowing effect */}
              <motion.div
                className="absolute -inset-2 bg-[#2e5797]/20 blur-2xl rounded-full"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Transform your ideas into polished, professional content with AI that learns and adapts to your unique writing style—preserving your voice while perfecting every word.
          </motion.p>

          {/* Interactive Typing Demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mb-12"
          >
            <TypingDemo />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/register">
              <motion.div
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 0 30px rgba(46, 87, 151, 0.5)"
                }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#2e5797] to-[#1a3d6b] hover:from-[#4a7bc8] hover:to-[#2e5797] text-white font-semibold px-8 py-4 text-lg gap-2 rounded-xl"
                >
                  Experience the Magic
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </motion.div>
                </Button>
              </motion.div>
            </Link>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                size="lg"
                className="border-[#2e5797]/30 hover:border-[#2e5797] hover:bg-[#2e5797]/10 text-foreground px-8 py-4 text-lg rounded-xl"
              >
                See How It Works
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-16 text-center"
          >
            <p className="text-muted-foreground text-sm mb-6">
              Trusted by over 10,000+ writers worldwide
            </p>
            <div className="flex justify-center items-center gap-8 opacity-60">
              {/* Placeholder for company logos or trust badges */}
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ delay: i * 0.1, duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-[#2e5797]"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-[#2e5797]/30 rounded-full flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 15, 0], opacity: [1, 0, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-2 bg-[#2e5797] rounded-full mt-2"
          />
        </motion.div>
      </motion.div>
    </motion.section>
  )
}