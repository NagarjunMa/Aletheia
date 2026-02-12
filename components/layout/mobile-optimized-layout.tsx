'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MobileHeader } from './mobile-header'
import { ResponsiveContainer } from './responsive-container'

interface MobileOptimizedLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  className?: string
  containerSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showHeader?: boolean
  fullHeight?: boolean
}

export function MobileOptimizedLayout({
  children,
  title,
  subtitle,
  className,
  containerSize = 'xl',
  showHeader = true,
  fullHeight = false
}: MobileOptimizedLayoutProps) {
  return (
    <div className={cn(
      'min-h-screen bg-background',
      fullHeight && 'h-screen flex flex-col',
      className
    )}>
      {showHeader && (
        <MobileHeader
          title={title}
          subtitle={subtitle}
        />
      )}

      <main className={cn(
        'flex-1',
        showHeader ? 'pt-4 sm:pt-6' : 'pt-6',
        fullHeight && 'overflow-hidden'
      )}>
        <ResponsiveContainer size={containerSize} className={cn(
          fullHeight && 'h-full'
        )}>
          {children}
        </ResponsiveContainer>
      </main>
    </div>
  )
}