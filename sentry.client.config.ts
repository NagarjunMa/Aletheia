import * as Sentry from "@sentry/nextjs";
import {
  sentryBeforeSend,
  sentryBeforeBreadcrumb,
} from "@/lib/sentry-scrubbers";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Replay may only be enabled for the client-side
  integrations: [
    Sentry.replayIntegration({
      // Mask all visible text and form inputs in session recordings. Resume
      // textarea + email + dashboard content stay redacted before reaching
      // Sentry. Without these, the resume can be captured in error replays.
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Defense-in-depth: scrub auth headers / tokens / PII fields from every
  // event and breadcrumb before they leave the browser.
  beforeSend: sentryBeforeSend,
  beforeBreadcrumb: sentryBeforeBreadcrumb,
});
