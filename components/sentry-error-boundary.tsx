'use client'

import { Button } from '@/components/ui/button'

interface SentryErrorFallbackProps {
  error: Error
  resetError: () => void
}

export function SentryErrorFallback({ error, resetError }: SentryErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">
          We've been notified and are working to fix this issue.
        </p>
        <Button
          onClick={resetError}
          variant="default"
          className="px-4 py-2"
        >
          Try Again
        </Button>
      </div>
    </div>
  )
}