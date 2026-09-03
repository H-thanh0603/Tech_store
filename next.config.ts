import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Pin the workspace root to this project. A stray lockfile higher up the drive
// (D:\pnpm-lock.yaml) otherwise makes Next infer the wrong root and mis-trace files.
const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  // Playwright drives the dev server on http://127.0.0.1:3000. Without this,
  // Next blocks its own dev chunks as a cross-origin request, the page never
  // hydrates, and every interaction test fails for the wrong reason.
  // Dev-only setting: it has no effect on `next start`.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    // Seed demos use placehold.co SVG placeholders.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'img.vietqr.io' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see: https://www.npmjs.com/package/@sentry/nextjs-webpack-plugin

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI.
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time).
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size.
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors.
  automaticVercelMonitors: true,
})
