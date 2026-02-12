'use client'

import { ThemeProvider } from 'next-themes'
import { CacheProvider } from '@/lib/query/cache-provider'
import { MonitoringProvider } from '@/components/providers/monitoring-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <CacheProvider>
        <MonitoringProvider>
          {children}
        </MonitoringProvider>
      </CacheProvider>
    </ThemeProvider>
  )
}