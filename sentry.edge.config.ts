import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN
const isErrorReportingEnabled = process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true'

if (isErrorReportingEnabled && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,

    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  })
}
