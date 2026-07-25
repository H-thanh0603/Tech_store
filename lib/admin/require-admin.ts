import { redirect } from 'next/navigation'

import { isAdminAuthenticated } from '@/lib/admin/auth'
import {
  canAccessModule,
  DEFAULT_ADMIN_ROLE,
  type AdminModule,
  type AdminRole,
} from '@/lib/admin/permissions'

export type AdminSession = {
  role: AdminRole
}

/**
 * Server-side gate for admin pages and mutations.
 * Redirects unauthenticated users to login; returns role for permission checks.
 */
export async function requireAdminPage(): Promise<AdminSession> {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login')
  }
  return { role: DEFAULT_ADMIN_ROLE }
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
