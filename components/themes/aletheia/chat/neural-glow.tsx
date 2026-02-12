'use client'

import { motion } from 'framer-motion'

export const NeuralGlow = () => (
  <>
    {/* Primary glow with pulsing effect */}
    <motion.div
      className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-r from-aletheia2-accent/20 via-aletheia2-accent/30 to-aletheia2-accent/20 z-0"
      style={{
        filter: 'blur(40px)',
        willChange: 'transform, opacity, filter'
      }}
      animate={{
        opacity: [0.3, 0.7, 0.3],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />

    {/* Secondary rotating glow for depth */}
    <motion.div
      className="absolute inset-0 rounded-[2.5rem] z-0"
      style={{
        background: 'conic-gradient(from 0deg, transparent, #6da9d2, transparent)',
        filter: 'blur(60px)',
        willChange: 'transform, opacity'
      }}
      animate={{
        rotate: 360,
        opacity: [0.2, 0.4, 0.2]
      }}
      transition={{
        rotate: {
          duration: 8,
          repeat: Infinity,
          ease: "linear"
        },
        opacity: {
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }}
    />
  </>
)