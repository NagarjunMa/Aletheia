import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true
      }),
      Sentry.feedbackIntegration({
        colorScheme: 'system'
      })
    ],

    // Error Filtering
    beforeSend: (event, hint) => {
      // Filter out specific errors
      const error = hint.originalException

      if (error && typeof error === 'object' && 'message' in error) {
        const message = error.message as string

        // Ignore network errors that are expected
        if (message.includes('NetworkError') && message.includes('fetch')) {
          return null
        }

        // Ignore ResizeObserver loop errors (common in browsers)
        if (message.includes('ResizeObserver loop limit exceeded')) {
          return null
        }

        // Ignore non-error promises
        if (message.includes('Non-Error promise rejection')) {
          return null
        }
      }

      // Filter out localhost errors in development
      if (process.env.NODE_ENV === 'development') {
        if (event.request?.url?.includes('localhost')) {
          return null
        }
      }

      return event
    },

    // User Context
    initialScope: {
      tags: {
        component: 'client'
      }
    },

    // Debug options
    debug: process.env.NODE_ENV === 'development',

    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Attach stack traces to errors
    attachStacktrace: true,

    // Capture unhandled promise rejections
    captureUnhandledRejections: true,

    // Transport options
    transport: Sentry.makeFetchTransport,
    transportOptions: {
      // Rate limiting
      rateLimits: {
        maxRetries: 3
      }
    }
  })
}

// Custom error boundary helper
export const withSentry = (Component: React.ComponentType) => {
  return Sentry.withErrorBoundary(Component, {
    fallback: ({ error, resetError }) => (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-4">
            We've been notified and are working to fix this issue.
          </p>
          <button
            onClick={resetError}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    ),
    beforeCapture: (scope, error, errorInfo) => {
      scope.setContext('errorInfo', errorInfo)
      scope.setLevel('error')
    }
  })
}