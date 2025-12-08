import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Node.js specific configurations
    integrations: [
      Sentry.nodeProfilingIntegration()
    ],

    // Error Filtering for server
    beforeSend: (event, hint) => {
      const error = hint.originalException

      if (error && typeof error === 'object' && 'message' in error) {
        const message = error.message as string

        // Filter out expected errors
        if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
          return null
        }

        // Filter out Supabase auth errors that are expected
        if (message.includes('Invalid login credentials')) {
          return null
        }

        // Filter out rate limit errors (handle them differently)
        if (message.includes('Rate limit exceeded')) {
          // Log but don't send to Sentry
          console.warn('Rate limit exceeded:', error)
          return null
        }
      }

      return event
    },

    // Server-specific scope
    initialScope: {
      tags: {
        component: 'server'
      }
    },

    // Debug in development
    debug: process.env.NODE_ENV === 'development',

    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // Server-specific options
    maxValueLength: 8192,

    // Profiling (production only)
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0
  })
}

// Server action error wrapper
export const withServerErrorHandling = <T extends any[], R>(
  serverAction: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await serverAction(...args)
    } catch (error) {
      // Capture error context
      Sentry.withScope(scope => {
        scope.setTag('type', 'server_action')
        scope.setContext('args', { args })
        Sentry.captureException(error)
      })

      // Re-throw for proper error handling
      throw error
    }
  }
}

// API route error wrapper
export const withAPIErrorHandling = (
  handler: (req: any, res: any) => Promise<any>
) => {
  return async (req: any, res: any) => {
    try {
      return await handler(req, res)
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setTag('type', 'api_route')
        scope.setContext('request', {
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: req.body
        })
        Sentry.captureException(error)
      })

      throw error
    }
  }
}