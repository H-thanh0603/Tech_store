// This file configures Sentry for edge runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE || undefined,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while setting up Sentry.
  debug: false,
})
