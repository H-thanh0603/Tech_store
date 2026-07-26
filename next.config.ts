import type { NextConfig } from 'next'

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
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' http://127.0.0.1:54321 http://localhost:54321 https:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
