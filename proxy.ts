import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

// Admin authorization is enforced by server-side guards (require-admin.ts)
// against Supabase Auth + admin_users; the proxy only refreshes sessions.
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Refresh customer session. Skip Next internals and static assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
