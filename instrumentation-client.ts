import * as Sentry from "@sentry/nextjs";
import {
  sentryBeforeBreadcrumb,
  sentryBeforeSend,
} from "@/lib/sentry-scrubbers";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isErrorReportingEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === "true";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

if (isErrorReportingEnabled && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
    beforeBreadcrumb: sentryBeforeBreadcrumb,
  });
}
