'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Application Error
            </h2>
            <p className="text-gray-600 mb-6">
              Something unexpected happened. We've been notified and are working to fix this issue.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 mb-2">
                  Error Details
                </summary>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {error.message}
                </pre>
              </details>
            )}
            <div className="space-x-3">
              <Button
                onClick={reset}
                variant="default"
              >
                Try Again
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}