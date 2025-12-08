import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',

    // Edge runtime specific configuration
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

    // Edge-specific scope
    initialScope: {
      tags: {
        component: 'edge'
      }
    },

    // Minimal configuration for edge runtime
    beforeSend: (event, hint) => {
      const error = hint.originalException

      if (error && typeof error === 'object' && 'message' in error) {
        const message = error.message as string

        // Filter edge-specific expected errors
        if (message.includes('edge runtime')) {
          return null
        }
      }

      return event
    },

    debug: false, // Disable debug in edge runtime

    // Reduced configuration for edge constraints
    maxValueLength: 2048
  })
}

// Edge function error wrapper
export const withEdgeErrorHandling = (
  handler: (req: Request) => Promise<Response>
) => {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req)
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setTag('type', 'edge_function')
        scope.setContext('request', {
          url: req.url,
          method: req.method
        })
        Sentry.captureException(error)
      })

      // Return error response
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
}