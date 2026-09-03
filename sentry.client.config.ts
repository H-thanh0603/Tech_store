// This file configures Sentry for node usage.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE || undefined,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while in development and sample at a lower rate in production.
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use Session Replay.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
