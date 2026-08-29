import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

// Admin authorization is enforced by server-side guards (require-admin.ts)
// against Supabase Auth + admin_users; the proxy only refreshes sessions.
export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID()
  const development = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https: wss:${development ? ' http://127.0.0.1:54321 http://localhost:54321' : ''}`,
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = await updateSession(request, requestHeaders)
  response.headers.set('Content-Security-Policy', csp)
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
