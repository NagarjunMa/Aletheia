'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'subtle' | 'glow'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
  hover?: boolean
  glow?: boolean
}

const cardVariants = {
  default: 'bg-aletheia-glass backdrop-blur-lg border border-aletheia-glass-border shadow-lg',
  elevated: 'bg-aletheia-glass backdrop-blur-xl border border-aletheia-glass-border shadow-2xl shadow-aletheia-primary/10',
  subtle: 'bg-aletheia-glass/50 backdrop-blur-md border border-aletheia-glass-border/50 shadow-sm',
  glow: 'bg-aletheia-glass backdrop-blur-lg border border-aletheia-gold/20 shadow-2xl shadow-aletheia-gold/20 animate-glow'
}

const sizeVariants = {
  sm: 'p-3 rounded-lg',
  md: 'p-4 rounded-xl',
  lg: 'p-6 rounded-2xl',
  xl: 'p-8 rounded-3xl'
}

const animationVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    filter: 'blur(10px)'
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease: [0.25, 1, 0.5, 1]
    }
  },
  hover: {
    y: -2,
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: [0.25, 1, 0.5, 1]
    }
  }
}

export function GlassCard({
  children,
  variant = 'default',
  size = 'md',
  animate = true,
  hover = true,
  glow = false,
  className,
  ...props
}: GlassCardProps) {
  const baseClasses = cn(
    'relative transition-all duration-300',
    cardVariants[variant],
    sizeVariants[size],
    glow && 'animate-pulse-glow',
    className
  )

  if (animate) {
    return (
      <motion.div
        className={baseClasses}
        variants={animationVariants}
        initial="hidden"
        animate="visible"
        whileHover={hover ? "hover" : undefined}
        {...props}
      >
        {children}

        {/* Glass reflection effect */}
        <div className="absolute inset-0 rounded-inherit bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        {/* Inner glow effect for glow variant */}
        {glow && (
          <div className="absolute inset-0 rounded-inherit bg-gradient-to-r from-aletheia-gold/10 via-transparent to-aletheia-gold/10 pointer-events-none" />
        )}
      </motion.div>
    )
  }

  return (
    <div className={baseClasses} {...props}>
      {children}

      {/* Glass reflection effect */}
      <div className="absolute inset-0 rounded-inherit bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      {/* Inner glow effect for glow variant */}
      {glow && (
        <div className="absolute inset-0 rounded-inherit bg-gradient-to-r from-aletheia-gold/10 via-transparent to-aletheia-gold/10 pointer-events-none" />
      )}
    </div>
  )
}