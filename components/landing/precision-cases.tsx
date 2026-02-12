'use client'

// Precision Cases - Use Cases Section
// Following Rule 2: Layout-stable animations for CLS prevention

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Linkedin, Quote, FileText } from 'lucide-react'
import Link from 'next/link'

const useCases = [
  {
    icon: <Linkedin className="w-8 h-8" />,
    tag: "Professional Presence",
    headline: "Executive Communication.",
    copy: "Transform rough ideas into executive-level communication that builds authority and drives results in professional settings.",
    button: "Enhance Now",
    href: "/auth/register?use-case=professional"
  },
  {
    icon: <Quote className="w-8 h-8" />,
    tag: "Content Creation",
    headline: "Authentic Voice.",
    copy: "Create compelling content that resonates with your audience while maintaining your unique perspective and communication style.",
    button: "Start Writing",
    href: "/auth/register?use-case=content"
  },
  {
    icon: <FileText className="w-8 h-8" />,
    tag: "Business Documents",
    headline: "Strategic Clarity.",
    copy: "Generate proposals, reports, and documentation that communicate complex ideas clearly and persuasively to stakeholders.",
    button: "Get Started",
    href: "/auth/register?use-case=business"
  }
]

// Animation variants for staggered reveals
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3
    }
  }
}

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1]
    }
  }
}

export function PrecisionCases() {
  return (
    <section id="use-cases" className="py-60 bg-white text-black">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section Header */}
        <motion.div
          className="mb-32"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          layout // Rule 2: Prevents layout shift
        >
          <motion.h2
            className="text-7xl md:text-8xl font-black tracking-tighter mb-8 text-black"
            layoutId="cases-title" // Shared element animation
          >
            Contextual{' '}
            <br />
            Precision.
          </motion.h2>
          <motion.p
            className="text-black/40 text-3xl font-light"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            layout
          >
            The tool adapts, your voice stays consistent.
          </motion.p>
        </motion.div>

        {/* Use Cases Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {useCases.map((useCase, idx) => (
            <motion.div
              key={idx}
              variants={cardVariants}
              whileHover={{
                y: -10,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
              className="group p-16 bg-white border border-black/5 rounded-[4rem] hover:bg-black hover:text-white transition-all duration-500 flex flex-col h-full shadow-2xl"
              style={{ willChange: 'transform, background-color, color' }} // GPU acceleration
              layout // Rule 2: Layout stability
            >

              {/* Icon */}
              <motion.div
                className="mb-12 p-5 bg-black/5 rounded-3xl w-fit group-hover:bg-ascendia-accent group-hover:text-black transition-all duration-500"
                whileHover={{
                  rotate: [0, -5, 5, 0],
                  transition: { duration: 0.5 }
                }}
                style={{ willChange: 'transform, background-color, color' }}
                layout
              >
                {useCase.icon}
              </motion.div>

              {/* Tag */}
              <motion.span
                className="text-[11px] font-black tracking-[0.5em] uppercase mb-8 opacity-40"
                layout
              >
                {useCase.tag}
              </motion.span>

              {/* Headline */}
              <motion.h3
                className="text-4xl font-bold mb-10 leading-none group-hover:text-white transition-colors duration-500"
                layout
              >
                {useCase.headline}
              </motion.h3>

              {/* Copy */}
              <motion.p
                className="text-xl opacity-60 font-light mb-16 flex-grow leading-relaxed group-hover:text-white/80 transition-colors duration-500"
                layout
              >
                {useCase.copy}
              </motion.p>

              {/* CTA Button */}
              <Link href={useCase.href}>
                <motion.button
                  className="flex items-center gap-4 font-black group-hover:text-ascendia-accent transition-colors text-xl uppercase tracking-widest w-full"
                  whileHover={{
                    x: 5,
                    transition: { duration: 0.2 }
                  }}
                  style={{ willChange: 'transform, color' }}
                  layout
                >
                  {useCase.button}
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-3 transition-transform duration-300" />
                </motion.button>
              </Link>

              {/* Hover accent line */}
              <motion.div
                className="mt-8 w-full h-px bg-gradient-to-r from-transparent via-ascendia-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                layout
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-32 pt-16 border-t border-black/10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ delay: 0.8, duration: 0.6 }}
          layout
        >
          {[
            { number: "10K+", label: "Active Users" },
            { number: "89%", label: "Cost Savings" },
            { number: "2.3s", label: "Avg Response" },
            { number: "99.2%", label: "Accuracy Rate" }
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              className="text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 + 1.0 }}
              layout
            >
              <motion.div
                className="text-4xl md:text-5xl font-black text-ascendia-accent mb-3"
                layout
              >
                {stat.number}
              </motion.div>
              <motion.div
                className="text-black/60 font-medium"
                layout
              >
                {stat.label}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}