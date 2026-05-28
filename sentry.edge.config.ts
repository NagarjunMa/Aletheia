import * as Sentry from "@sentry/nextjs";
import {
  sentryBeforeSend,
  sentryBeforeBreadcrumb,
} from "@/lib/sentry-scrubbers";

const SENTRY_DSN = process.env.SENTRY_DSN;
const isErrorReportingEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === "true";

if (isErrorReportingEnabled && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,

    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

    // Defense-in-depth: scrub auth headers / tokens / PII fields from every
    // event and breadcrumb before they leave middleware.
    beforeSend: sentryBeforeSend,
    beforeBreadcrumb: sentryBeforeBreadcrumb,
  });
}
