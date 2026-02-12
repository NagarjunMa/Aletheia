'use client'

// Hero Section with Parallax Effects
// Following Rule 2: Layout-stable animations for performance

import React from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, MessageSquare, Zap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { animationConfig, animationVariants } from '@/lib/animations/performance-config'

export function HeroSection() {
  const { scrollY } = useScroll()

  // Parallax transforms with reduced ranges for better performance
  const yBg = useTransform(scrollY, [0, 800], [0, 200])
  const yText = useTransform(scrollY, [0, 800], [0, -100])
  const opacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <section className="relative pt-40 pb-20 overflow-hidden min-h-screen flex items-center justify-center">
      {/* Dynamic Background with Parallax - GPU accelerated */}
      <motion.div
        style={{
          y: yBg,
          willChange: 'transform' // GPU acceleration
        }}
        className="absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] bg-ascendia-accent rounded-full blur-[80px] opacity-10" />
        <div className="absolute -bottom-20 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
      </motion.div>

      <div className="max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: animationConfig.duration.slow, ease: animationConfig.easing.smooth }}
          style={{
            y: yText,
            opacity,
            willChange: 'transform, opacity' // Performance optimization
          }}
          layout // Rule 2: Prevents layout shift
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-3 px-5 py-2 mb-10 text-[10px] font-black tracking-[0.4em] border border-ascendia-accent/30 rounded-full text-ascendia-accent bg-ascendia-accent/5 uppercase"
            layoutId="hero-badge" // Shared element animation
          >
            <span className="w-1.5 h-1.5 bg-ascendia-accent rounded-full animate-ping" />
            AI Writing Assistant
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            className="text-6xl md:text-[8rem] font-black tracking-tighter leading-[0.85] mb-12 text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            layout
          >
            We don't write{' '}
            <br className="hidden md:block" />
            for you.
            <motion.span
              className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-ascendia-accent to-ascendia-accent/40 italic mt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              We enhance you.
            </motion.span>
          </motion.h1>

          {/* Description */}
          <motion.p
            className="text-xl md:text-3xl text-white/40 max-w-3xl mx-auto mb-16 leading-relaxed font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            layout
          >
            Transform unclear requests into professional communication.
            Ascendia elevates human thought while preserving your authentic voice.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            layout
          >
            <Link href="/auth/register">
              <motion.button
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 0 40px rgba(46,87,151,0.3)",
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                className="group relative px-12 py-6 bg-ascendia-accent text-white font-black rounded-full overflow-hidden transition-all text-lg uppercase tracking-widest shadow-xl"
                style={{ willChange: 'transform' }}
              >
                <span className="relative z-10 flex items-center gap-3">
                  Start Creating{' '}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </span>
              </motion.button>
            </Link>

            <Link href="#philosophy">
              <motion.button
                whileHover={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'white',
                  transition: { duration: 0.2 }
                }}
                className="px-12 py-6 border border-white/10 text-white font-bold rounded-full transition-all text-lg uppercase tracking-widest hover:scale-105"
                style={{ willChange: 'transform' }}
              >
                Learn More
              </motion.button>
            </Link>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            className="mt-20 flex flex-col sm:flex-row items-center justify-center gap-8 text-white/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-ascendia-accent" />
              <span className="text-sm font-medium">10,000+ Active Users</span>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-ascendia-accent" />
              <span className="text-sm font-medium">89% Cost Reduction</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-ascendia-accent rounded-full animate-pulse" />
              <span className="text-sm font-medium">Real-time Processing</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-20"
        style={{ willChange: 'transform' }}
      >
        <span className="text-[9px] tracking-[0.5em] uppercase font-black text-white">Scroll</span>
        <div className="w-px h-16 bg-gradient-to-b from-ascendia-accent to-transparent" />
      </motion.div>
    </section>
  )
}