/**
 * Animation Performance Configuration
 * Optimized for Google AI Studio-level smoothness and responsiveness
 */

export const animationConfig = {
  // Easing functions for natural motion (matches Google AI Studio patterns)
  easing: {
    // Smooth ease-out for natural deceleration
    smooth: [0.16, 1, 0.3, 1] as [number, number, number, number],
    // Quick interactions for immediate feedback
    quick: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    // Bouncy for playful elements
    bouncy: [0.68, -0.55, 0.265, 1.55] as [number, number, number, number],
  },

  // Duration presets for consistent timing
  duration: {
    fast: 0.2,      // Hover states, quick interactions
    medium: 0.5,    // Standard transitions
    slow: 0.8,      // Page transitions, complex animations
    background: 12, // Background ambience animations
  },

  // Scale ranges for performance (avoid large scales that cause reflows)
  scale: {
    subtle: { from: 1, to: 1.02 },    // Very subtle hover
    gentle: { from: 1, to: 1.05 },    // Standard hover
    moderate: { from: 1, to: 1.1 },   // Emphasized elements
    tap: { from: 1, to: 0.95 },       // Tap feedback
  },

  // Blur values optimized for performance
  blur: {
    light: 20,     // Subtle background blur
    medium: 40,    // Standard atmospheric blur
    heavy: 60,     // Maximum blur without major performance hit
  },

  // Stagger timing for grouped animations
  stagger: {
    quick: 0.05,   // Rapid sequence
    normal: 0.1,   // Standard spacing
    slow: 0.2,     // Deliberate sequence
  },

  // Viewport animation settings
  viewport: {
    // Start animation when element is 100px from entering viewport
    margin: "-100px",
    // Only animate once for performance
    once: true,
  },

  // Performance optimization flags
  performance: {
    // Enable hardware acceleration for all animations
    willChange: 'transform' as const,
    // Prefer transform and opacity changes
    gpuOptimized: {
      transform: true,
      opacity: true,
      scale: true,
      rotate: true,
    },
  },
}

// Pre-configured animation variants for common patterns
export const animationVariants = {
  // Fade in from bottom (like Google AI Studio cards)
  fadeInUp: {
    initial: {
      opacity: 0,
      y: 40,
      scale: 0.95,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: animationConfig.duration.medium,
        ease: animationConfig.easing.smooth,
      },
    },
  },

  // Container for staggered children
  staggerContainer: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: animationConfig.stagger.normal,
        delayChildren: 0.2,
      },
    },
  },

  // Gentle hover interaction
  gentleHover: {
    whileHover: {
      y: -8,
      scale: animationConfig.scale.gentle.to,
      transition: {
        duration: animationConfig.duration.fast,
        ease: animationConfig.easing.quick,
      },
    },
    whileTap: {
      scale: animationConfig.scale.tap.to,
      transition: {
        duration: 0.1,
      },
    },
  },

  // Background ambient animation (like Google AI Studio backgrounds)
  ambientBackground: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.1, 0.2, 0.1],
      rotate: [0, 5, 0],
    },
    transition: {
      duration: animationConfig.duration.background,
      repeat: Infinity,
      ease: "linear",
    },
  },

  // Smooth scroll-based parallax
  parallaxSlow: (scrollY: any, range: [number, number], outputRange: [number, number]) => ({
    y: scrollY,
    transition: { type: "spring", stiffness: 100, damping: 30 },
  }),
}

// Responsive animation settings
export const responsiveAnimations = {
  // Reduce motion on mobile for battery life
  mobile: {
    scale: { ...animationConfig.scale, gentle: { from: 1, to: 1.02 } },
    duration: { ...animationConfig.duration, background: 20 },
    blur: { ...animationConfig.blur, heavy: 30 },
  },

  // Full animations on desktop
  desktop: animationConfig,
}

// Utility function to get appropriate config based on device
export const getAnimationConfig = () => {
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 768
    return isMobile ? responsiveAnimations.mobile : responsiveAnimations.desktop
  }
  return animationConfig
}

// Performance monitoring helpers
export const animationPerformance = {
  // Check if user prefers reduced motion
  prefersReducedMotion: () => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return false
  },

  // Get optimized config for reduced motion
  getReducedMotionConfig: () => ({
    ...animationConfig,
    duration: {
      fast: 0,
      medium: 0,
      slow: 0.2,
      background: 0,
    },
    scale: {
      subtle: { from: 1, to: 1 },
      gentle: { from: 1, to: 1 },
      moderate: { from: 1, to: 1 },
      tap: { from: 1, to: 1 },
    },
  }),
}