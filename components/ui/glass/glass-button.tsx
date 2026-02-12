'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glow' | 'success' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  asChild?: boolean
  loading?: boolean
  glow?: boolean
  ripple?: boolean
}

const buttonVariants = {
  primary: 'bg-aletheia-gold/20 hover:bg-aletheia-gold/30 border-aletheia-gold/40 text-aletheia-gold shadow-lg shadow-aletheia-gold/20',
  secondary: 'bg-aletheia-glass hover:bg-aletheia-glass-border border-aletheia-glass-border text-aletheia-text shadow-lg',
  ghost: 'bg-transparent hover:bg-aletheia-glass border-transparent hover:border-aletheia-glass-border text-aletheia-text-muted hover:text-aletheia-text',
  glow: 'bg-aletheia-gold/30 hover:bg-aletheia-gold/40 border-aletheia-gold text-aletheia-bg shadow-2xl shadow-aletheia-gold/40 animate-glow',
  success: 'bg-aletheia-success/20 hover:bg-aletheia-success/30 border-aletheia-success/40 text-aletheia-success shadow-lg shadow-aletheia-success/20',
  danger: 'bg-aletheia-error/20 hover:bg-aletheia-error/30 border-aletheia-error/40 text-aletheia-error shadow-lg shadow-aletheia-error/20'
}

const sizeVariants = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-base rounded-xl',
  lg: 'px-6 py-3 text-lg rounded-2xl',
  icon: 'w-10 h-10 rounded-xl'
}

const buttonMotionVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.05,
    boxShadow: "0 10px 40px rgba(245, 158, 11, 0.3)",
    transition: { duration: 0.2 }
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1 }
  },
  loading: {
    scale: 1,
    opacity: 0.7,
  }
}

export function GlassButton({
  className,
  variant = 'primary',
  size = 'md',
  asChild = false,
  loading = false,
  glow = false,
  ripple = true,
  children,
  disabled,
  ...props
}: GlassButtonProps) {
  const Comp = asChild ? Slot : motion.button

  const baseClasses = cn(
    'relative inline-flex items-center justify-center font-medium transition-all duration-300',
    'backdrop-blur-lg border focus:outline-none focus:ring-2 focus:ring-aletheia-gold/50 focus:ring-offset-2 focus:ring-offset-aletheia-bg',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
    'overflow-hidden group',
    buttonVariants[variant],
    sizeVariants[size],
    glow && 'animate-pulse-glow',
    className
  )

  return (
    <Comp
      className={baseClasses}
      variants={buttonMotionVariants}
      initial="initial"
      whileHover={!disabled && !loading ? "hover" : undefined}
      whileTap={!disabled && !loading ? "tap" : undefined}
      animate={loading ? "loading" : "initial"}
      disabled={disabled || loading}
      {...props}
    >
      {/* Glass reflection gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-inherit" />

      {/* Ripple effect on hover */}
      {ripple && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </div>
      )}

      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {loading ? (
          <>
            <motion.div
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </span>

      {/* Glow effect for glow variant */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-r from-aletheia-gold/20 via-aletheia-gold/10 to-aletheia-gold/20 rounded-inherit blur-sm pointer-events-none" />
      )}
    </Comp>
  )
}