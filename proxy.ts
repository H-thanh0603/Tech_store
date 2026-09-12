import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

// Admin authorization is enforced by server-side guards (require-admin.ts)
// against Supabase Auth + admin_users; the proxy only refreshes sessions.

// Vercel Preview deployments share the production Supabase project unless a
// staging project is wired up (docs/ops/STAGING.md, OPS-003). Read-only
// previews are safe; any write from a PR preview (checkout, server action,
// admin CRUD) would land in the production database. Block writes at this
// chokepoint until ALLOW_PREVIEW_WRITES is deliberately set to 1.
function previewWriteBlocked(request: NextRequest): boolean {
  if (process.env.VERCEL_ENV !== 'preview') return false
  if (process.env.ALLOW_PREVIEW_WRITES === '1') return false
  if (request.method === 'GET' || request.method === 'HEAD') return false
  // Next.js server actions surface as POSTs to the current page path; API
  // route writes are POST/PUT/PATCH/DELETE — both fall through to the block.
  return true
}

export async function proxy(request: NextRequest) {
  if (previewWriteBlocked(request)) {
    return new Response(
      JSON.stringify({
        code: 'PREVIEW_READ_ONLY',
        message:
          'Preview deployment đang ở chế độ chỉ đọc để bảo vệ database production (OPS-003). Đặt ALLOW_PREVIEW_WRITES=1 ở Vercel preview env nếu cần test ghi, hoặc dùng staging project — xem docs/ops/STAGING.md.',
      }),
      {
        status: 403,
        headers: { 'content-type': 'application/json; charset=utf-8', 'x-request-id': crypto.randomUUID() },
      },
    )
  }

  const nonce = crypto.randomUUID()
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const development = process.env.NODE_ENV === 'development'

  // connect-src is the exfiltration channel for a compromised dependency:
  // if a rogue script ever runs, this is the allowlist it can phone home
  // through. Supabase (project REST) and Sentry (error ingest) are the
  // only third-party origins the browser talks to.
  const connectSources = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.sentry.io',
    'https://sentry.io',
    ...(development
      ? ['http://127.0.0.1:54321', 'http://localhost:54321', 'ws://127.0.0.1:54321', 'ws://localhost:54321']
      : []),
  ]

  // NOTE (2026-09-12, verified on production): script-src MUST NOT use a
  // per-request nonce. `/` and product pages are ISR-cached, so the HTML in
  // the cache carries the nonce baked at render time while the next request
  // sends a fresh nonce in the header — the browser then blocks every Next.js
  // hydration/flight inline script and the page stays a skeleton forever
  // (React #412). Nonce + ISR cache are fundamentally incompatible, so inline
  // scripts are allowed here; external scripts are still restricted to 'self'
  // and exfiltration is still bounded by connect-src + object-src + reporting.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    // Violations land in /api/csp-report, which logs them (and therefore
    // feeds Sentry) so a policy regression or an injection attempt is
    // observable in production instead of silently breaking a page.
    "report-uri /api/csp-report",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-request-id', requestId)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = await updateSession(request, requestHeaders)
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: [
    /*
     * Refresh customer session. Skip Next internals and static assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
