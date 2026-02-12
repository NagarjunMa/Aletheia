/**
 * Responsive Utilities
 * Mobile-first responsive design helpers and breakpoint utilities
 */

// Tailwind CSS breakpoints
export const breakpoints = {
  sm: 640,   // Small tablets and large phones
  md: 768,   // Tablets
  lg: 1024,  // Laptops
  xl: 1280,  // Desktop
  '2xl': 1536 // Large desktop
} as const

export type Breakpoint = keyof typeof breakpoints

/**
 * Check if current viewport matches a breakpoint
 */
export const useViewport = () => {
  if (typeof window === 'undefined') return null

  const width = window.innerWidth

  return {
    width,
    isMobile: width < breakpoints.sm,
    isTablet: width >= breakpoints.sm && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    isSmall: width < breakpoints.md,
    isMedium: width >= breakpoints.md && width < breakpoints.xl,
    isLarge: width >= breakpoints.xl
  }
}

/**
 * Responsive class helpers
 */
export const responsive = {
  // Padding utilities
  padding: {
    none: 'p-0',
    sm: 'p-3 sm:p-4 md:p-6',
    md: 'p-4 sm:p-6 md:p-8',
    lg: 'p-6 sm:p-8 md:p-12'
  },

  // Margin utilities
  margin: {
    none: 'm-0',
    sm: 'm-3 sm:m-4 md:m-6',
    md: 'm-4 sm:m-6 md:m-8',
    lg: 'm-6 sm:m-8 md:m-12'
  },

  // Gap utilities for grids/flexbox
  gap: {
    none: 'gap-0',
    sm: 'gap-2 sm:gap-3 md:gap-4',
    md: 'gap-3 sm:gap-4 md:gap-6',
    lg: 'gap-4 sm:gap-6 md:gap-8'
  },

  // Text size utilities
  text: {
    xs: 'text-xs sm:text-sm',
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl md:text-2xl',
    xl: 'text-xl sm:text-2xl md:text-3xl'
  },

  // Container utilities
  container: {
    sm: 'max-w-sm mx-auto px-4',
    md: 'max-w-4xl mx-auto px-4 sm:px-6',
    lg: 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8',
    xl: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    full: 'w-full mx-auto px-4 sm:px-6 lg:px-8'
  }
}

/**
 * Mobile-first media queries for styled-components or other CSS-in-JS
 */
export const mediaQueries = {
  sm: `@media (min-width: ${breakpoints.sm}px)`,
  md: `@media (min-width: ${breakpoints.md}px)`,
  lg: `@media (min-width: ${breakpoints.lg}px)`,
  xl: `@media (min-width: ${breakpoints.xl}px)`,
  '2xl': `@media (min-width: ${breakpoints['2xl']}px)`
}

/**
 * Touch and mobile device detection
 */
export const deviceUtils = {
  isTouchDevice: () => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  },

  isMobileUserAgent: () => {
    if (typeof navigator === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  },

  isMobile: () => {
    return deviceUtils.isTouchDevice() && deviceUtils.isMobileUserAgent()
  },

  // Get preferred orientation
  getOrientation: () => {
    if (typeof screen === 'undefined') return null
    return screen.orientation?.type || 'unknown'
  }
}

/**
 * Dynamic classes based on viewport
 */
export const getDynamicClasses = (
  mobileClass: string,
  tabletClass?: string,
  desktopClass?: string
) => {
  const viewport = useViewport()

  if (!viewport) return mobileClass

  if (viewport.isDesktop) return desktopClass || tabletClass || mobileClass
  if (viewport.isTablet) return tabletClass || mobileClass
  return mobileClass
}

/**
 * Responsive grid columns helper
 */
export const getGridCols = (config: {
  mobile?: number
  tablet?: number
  desktop?: number
}) => {
  const { mobile = 1, tablet = mobile, desktop = tablet } = config

  return [
    `grid-cols-${mobile}`,
    `md:grid-cols-${tablet}`,
    `lg:grid-cols-${desktop}`
  ].join(' ')
}

/**
 * Adaptive spacing based on screen size
 */
export const getAdaptiveSpacing = (
  size: 'sm' | 'md' | 'lg' = 'md'
) => {
  const spacing = {
    sm: 'p-3 sm:p-4 md:p-6',
    md: 'p-4 sm:p-6 md:p-8',
    lg: 'p-6 sm:p-8 md:p-12'
  }

  return spacing[size]
}