'use client'

// Anti-AI Grid - Core Features Section
// Following Rule 2: Layout-stable animations for CLS prevention

import React from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, Fingerprint, Eraser } from 'lucide-react'

const features = [
  {
    icon: <ShieldAlert className="w-10 h-10 text-ascendia-accent" />,
    title: "Zero AI Hallucinations",
    desc: "Automatic detection and removal of AI-generated fiction. We preserve your facts while enhancing clarity and professionalism."
  },
  {
    icon: <Fingerprint className="w-10 h-10 text-ascendia-accent" />,
    title: "Voice Preservation",
    desc: "Our engine maintains your unique communication style while optimizing for clarity, ensuring authenticity in every response."
  },
  {
    icon: <Eraser className="w-10 h-10 text-ascendia-accent" />,
    title: "Context Intelligence",
    desc: "Advanced understanding of intent and context transforms vague requests into clear, actionable professional communication."
  }
]

// Container animation variants for performance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
}

// Item animation variants with layout stability
const itemVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1]
    }
  }
}

export function AntiAiGrid() {
  return (
    <section id="philosophy" className="py-40 bg-black relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-32"
          layout // Rule 2: Prevents layout shift
        >
          <motion.h2
            className="text-5xl md:text-7xl font-black mb-8 tracking-tighter text-white"
            layoutId="section-title" // Shared element animation
          >
            Human Intelligence
          </motion.h2>
          <motion.p
            className="text-2xl text-white/20 font-light max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            layout
          >
            The future is reached not by replacing humans, but by enhancing human potential.
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-10"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              whileHover={{
                y: -20,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
              className="group p-14 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 rounded-[3rem] transition-all hover:border-ascendia-accent/30 hover:shadow-[0_20px_60px_-15px_rgba(46,87,151,0.1)]"
              style={{ willChange: 'transform' }} // GPU acceleration
              layout // Rule 2: Layout stability
            >
              {/* Icon Container */}
              <motion.div
                whileInView={{
                  rotateY: [0, 360],
                  transition: {
                    duration: 1.5,
                    delay: idx * 0.2,
                    ease: "easeInOut"
                  }
                }}
                viewport={{ once: true }}
                className="mb-10 p-5 bg-white/5 rounded-3xl w-fit group-hover:bg-ascendia-accent/10 transition-colors duration-500"
                style={{ willChange: 'transform, background-color' }}
                layout
              >
                {feature.icon}
              </motion.div>

              {/* Content */}
              <motion.h3
                className="text-3xl font-bold mb-6 tracking-tight group-hover:text-ascendia-accent transition-colors duration-300 text-white"
                layout
              >
                {feature.title}
              </motion.h3>

              <motion.p
                className="text-white/40 leading-relaxed font-light text-xl"
                layout
              >
                {feature.desc}
              </motion.p>

              {/* Hover indicator */}
              <motion.div
                className="mt-8 w-full h-px bg-gradient-to-r from-transparent via-ascendia-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                layout
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ delay: 0.8, duration: 0.6 }}
          layout
        >
          <motion.p
            className="text-white/30 text-lg font-light italic max-w-md mx-auto"
            layout
          >
            "The best AI doesn't replace human creativity—it amplifies it."
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}