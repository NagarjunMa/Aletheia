'use client'

import { ThemeProvider } from 'next-themes'
import { PostHogProvider } from '@/lib/posthog/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <PostHogProvider>
        {children}
      </PostHogProvider>
    </ThemeProvider>
  )
}