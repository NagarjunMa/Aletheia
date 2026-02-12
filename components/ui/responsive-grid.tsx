'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ResponsiveGridProps {
  children: ReactNode
  className?: string
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  autoFit?: boolean
  minItemWidth?: string
}

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 'md',
  autoFit = false,
  minItemWidth = '250px'
}: ResponsiveGridProps) {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2 sm:gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
    xl: 'gap-8 sm:gap-12'
  }

  const getGridCols = () => {
    if (autoFit) {
      return `repeat(auto-fit, minmax(${minItemWidth}, 1fr))`
    }

    const classes = []
    if (cols.default) classes.push(`grid-cols-${cols.default}`)
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`)
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`)
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`)
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`)
    return classes.join(' ')
  }

  return (
    <div
      className={cn(
        'grid',
        !autoFit && getGridCols(),
        gapClasses[gap],
        className
      )}
      style={autoFit ? {
        gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}, 1fr))`
      } : undefined}
    >
      {children}
    </div>
  )
}