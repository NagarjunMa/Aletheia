'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { layout } from '@/lib/design-system'

interface MainLayoutProps {
  children: React.ReactNode
  user?: {
    id: string
    email?: string
    name?: string
    avatar_url?: string
    cpl_score?: number
  } | null
  onSignOut?: () => void
  className?: string
}

export function MainLayout({ children, user, onSignOut, className }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const handleMenuToggle = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <ThemeProvider>
      <div className={cn('min-h-screen bg-background font-sans antialiased', className)}>
        {/* Header */}
        <Header
          user={user}
          onSignOut={onSignOut}
          onMenuToggle={handleMenuToggle}
        />

        {/* Main content */}
        <main
          className="flex-1"
          style={{
            minHeight: `calc(100vh - ${layout.header.height})`,
            paddingTop: '0'
          }}
        >
          {children}
        </main>

        {/* Toast notifications */}
        <Toaster />
      </div>
    </ThemeProvider>
  )
}