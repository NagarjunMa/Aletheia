'use client'

// Ascent Timeline - Process Section with Animated Progress
// Following Rule 2: Layout-stable animations for performance

import React, { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { Mic, Layers, CheckCircle, Fingerprint } from 'lucide-react'

const steps = [
  {
    title: "Raw Input Capture",
    desc: "Share your thoughts naturally. No prompts, no templates. Just authentic human communication captured in real-time.",
    icon: <Mic className="w-6 h-6" />
  },
  {
    title: "Intelligence Mapping",
    desc: "Our AI analyzes your communication patterns, context, and intent to understand your unique voice and requirements.",
    icon: <Layers className="w-6 h-6" />
  },
  {
    title: "Enhanced Processing",
    desc: "Dual-track enhancement corrects grammar and structure while preserving your authentic voice and core message.",
    icon: <CheckCircle className="w-6 h-6" />
  },
  {
    title: "Professional Output",
    desc: "Receive polished, professional content that maintains your identity and communicates your intent with clarity.",
    icon: <Fingerprint className="w-6 h-6" />
  }
]

export function AscentTimeline() {
  const containerRef = useRef<HTMLElement>(null)

  // Scroll-based progress animation
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  })

  // Spring animation for smooth progress line
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    restDelta: 0.001
  })

  return (
    <section
      id="process"
      ref={containerRef}
      className="py-60 relative overflow-hidden bg-black"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start gap-12 md:gap-40">

          {/* Sticky Header */}
          <div className="md:sticky md:top-40 md:w-1/3">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              layout // Rule 2: Prevents layout shift
            >
              <motion.h2
                className="text-7xl font-black mb-10 tracking-tighter leading-none text-white"
                layoutId="timeline-title" // Shared element animation
              >
                The Enhancement Process
              </motion.h2>
              <motion.p
                className="text-white/30 text-2xl leading-relaxed font-light italic"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                layout
              >
                A vertical journey from raw thought to professional clarity.
              </motion.p>
            </motion.div>
          </div>

          {/* Timeline Steps */}
          <div className="md:w-2/3 space-y-48 relative">

            {/* Animated Progress Line */}
            <motion.div
              style={{
                scaleY,
                originY: 0,
                willChange: 'transform' // GPU acceleration
              }}
              className="absolute left-6 md:left-9 top-10 bottom-10 w-0.5 bg-gradient-to-b from-ascendia-accent via-ascendia-accent/50 to-transparent hidden sm:block"
              layout
            />

            {/* Steps */}
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.8,
                  delay: idx * 0.15,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="relative pl-0 sm:pl-32 group"
                layout // Rule 2: Layout stability
              >

                {/* Timeline Icon */}
                <motion.div
                  whileInView={{
                    scale: [1, 1.05, 1],
                    borderColor: [
                      "rgba(255,255,255,0.05)",
                      "rgba(46,87,151,1)",
                      "rgba(46,87,151,0.4)"
                    ]
                  }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.8,
                    delay: idx * 0.2,
                    ease: "easeInOut"
                  }}
                  className="absolute left-0 top-0 sm:left-3 sm:top-2 w-14 h-14 bg-black border-2 border-white/10 rounded-full flex items-center justify-center z-10 shadow-2xl"
                  style={{ willChange: 'transform, border-color' }}
                  layout
                >
                  <motion.div
                    className="group-hover:scale-110 group-hover:text-ascendia-accent transition-all duration-300 text-white"
                    style={{ willChange: 'transform, color' }}
                  >
                    {step.icon}
                  </motion.div>
                </motion.div>

                {/* Content */}
                <motion.div layout>
                  <motion.h3
                    className="text-5xl font-black mb-6 tracking-tight group-hover:text-ascendia-accent transition-colors duration-300 text-white"
                    layout
                  >
                    {step.title}
                  </motion.h3>
                  <motion.p
                    className="text-2xl text-white/40 leading-relaxed font-light"
                    layout
                  >
                    {step.desc}
                  </motion.p>
                </motion.div>

                {/* Step Number */}
                <motion.div
                  className="absolute -right-4 top-0 text-8xl font-black text-white/5 pointer-events-none"
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.2 + 0.5 }}
                  layout
                >
                  0{idx + 1}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Background Enhancement */}
      <motion.div
        className="absolute top-1/2 right-0 w-96 h-96 bg-ascendia-accent/5 rounded-full blur-[40px] -z-10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ willChange: 'transform, opacity' }}
      />
    </section>
  )
}