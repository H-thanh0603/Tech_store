import { redirect } from 'next/navigation'

import { getAdminSession, type AdminSession } from '@/lib/admin/auth'
import {
  canAccessModule,
  type AdminModule,
  type AdminRole,
} from '@/lib/admin/permissions'

export type { AdminSession } from '@/lib/admin/auth'

/**
 * Server-side gate for admin pages and mutations.
 * Redirects unauthenticated users to login; returns role for permission checks.
 */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) {
    redirect('/admin/login')
  }
  return session
}

/**
 * Require both an authenticated session and module permission.
 * Returns null when the role cannot access the module (caller renders PermissionDenied).
 */
export async function requireAdminModule(
  module: AdminModule,
): Promise<AdminSession | { forbidden: true; role: AdminRole }> {
  const session = await requireAdminPage()
  if (!canAccessModule(session.role, module)) {
    return { forbidden: true, role: session.role }
  }
  return session
}

export function isForbidden(
  result: AdminSession | { forbidden: true; role: AdminRole },
): result is { forbidden: true; role: AdminRole } {
  return 'forbidden' in result && result.forbidden === true
}
