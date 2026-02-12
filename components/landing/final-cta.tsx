'use client'

// Final CTA Section with Enhanced Footer
// Following Rule 2: Layout-stable animations for performance

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function FinalCta() {
  return (
    <>
      {/* Call to Action Section */}
      <section className="py-72 bg-black relative overflow-hidden">
        {/* Animated Background */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.05, 0.15, 0.05],
            rotate: [0, 45, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-ascendia-accent rounded-full blur-[60px] -z-10"
          style={{ willChange: 'transform, opacity' }} // GPU acceleration
        />

        <div className="max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            layout // Rule 2: Prevents layout shift
          >
            {/* Main Headline */}
            <motion.h2
              className="text-7xl md:text-9xl font-black tracking-tighter mb-16 leading-none text-white"
              layoutId="final-cta-title" // Shared element animation
            >
              Reclaim{' '}
              <br />
              Your Voice.
            </motion.h2>

            {/* Description */}
            <motion.p
              className="text-2xl md:text-3xl text-white/30 mb-20 font-light max-w-2xl mx-auto leading-relaxed italic"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              layout
            >
              Stop fighting AI prompts.{' '}
              <br className="md:hidden" />
              Start communicating clearly.
            </motion.p>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              layout
            >
              <Link href="/auth/register">
                <motion.button
                  whileHover={{
                    scale: 1.05,
                    boxShadow: "0 0 80px rgba(46,87,151,0.4)",
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="group px-20 py-8 bg-white text-black text-2xl font-black rounded-full shadow-2xl transition-all uppercase tracking-[0.2em] hover:bg-ascendia-accent hover:text-white"
                  style={{ willChange: 'transform' }}
                >
                  <span className="flex items-center gap-4">
                    Begin Your Enhancement
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                  </span>
                </motion.button>
              </Link>
            </motion.div>

            {/* Trust Indicator */}
            <motion.div
              className="mt-16 flex items-center justify-center gap-4 text-white/20"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.9 }}
              layout
            >
              <div className="w-2 h-2 bg-ascendia-accent rounded-full animate-pulse" />
              <span className="text-sm font-medium">Join 10,000+ professionals already enhanced</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Enhanced Footer */}
      <footer className="py-32 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-24"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            layout
          >
            {/* Brand Section */}
            <motion.div
              className="col-span-1 md:col-span-2"
              layout
            >
              <motion.div
                className="flex items-center gap-3 mb-10"
                layoutId="footer-logo"
              >
                <div className="w-8 h-8 bg-ascendia-accent rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
                <span className="text-3xl font-black tracking-tighter uppercase text-white">ASCENDIA</span>
              </motion.div>

              <motion.p
                className="text-white/30 max-w-sm mb-12 text-2xl font-light leading-relaxed"
                layout
              >
                The AI writing assistant for professionals who value authentic communication.
              </motion.p>

              <motion.div
                className="flex gap-6"
                layout
              >
                {['LinkedIn', 'Twitter', 'GitHub'].map((platform, idx) => (
                  <motion.a
                    key={platform}
                    href="#"
                    whileHover={{
                      scale: 1.1,
                      rotate: 5,
                      transition: { duration: 0.2 }
                    }}
                    className="w-14 h-14 rounded-2xl border border-white/10 flex items-center justify-center cursor-pointer hover:border-ascendia-accent transition-colors"
                    style={{ willChange: 'transform' }}
                  >
                    <span className="text-ascendia-accent text-sm font-bold">
                      {platform.slice(0, 2)}
                    </span>
                  </motion.a>
                ))}
              </motion.div>
            </motion.div>

            {/* Platform Links */}
            <motion.div layout>
              <h4 className="font-black mb-10 uppercase tracking-[0.3em] text-[10px] text-ascendia-accent">Platform</h4>
              <ul className="space-y-6 text-white/40 text-xl font-light">
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">API</Link></li>
              </ul>
            </motion.div>

            {/* Company Links */}
            <motion.div layout>
              <h4 className="font-black mb-10 uppercase tracking-[0.3em] text-[10px] text-ascendia-accent">Company</h4>
              <ul className="space-y-6 text-white/40 text-xl font-light">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </motion.div>
          </motion.div>

          {/* Bottom Footer */}
          <motion.div
            className="max-w-7xl mx-auto mt-32 pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] font-black tracking-[0.6em] text-white/10 uppercase"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            layout
          >
            <span>© 2024 ASCENDIA. ENGINEERED FOR EXCELLENCE.</span>
            <div className="flex gap-12">
              <motion.span
                className="hover:text-white transition-colors cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                System: Operational
              </motion.span>
              <motion.span
                className="hover:text-ascendia-accent transition-colors cursor-pointer underline"
                whileHover={{ scale: 1.05 }}
              >
                Built for Professionals
              </motion.span>
            </div>
          </motion.div>
        </div>
      </footer>
    </>
  )
}