import { redirect } from 'next/navigation'

import {
  adminSessionFromState,
  getAdminAuthState,
  type AdminAuthState,
  type AdminMfaStatus,
  type AdminSession,
} from '@/lib/admin/auth'
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
  const state = await getAdminAuthState()
  if (!state) redirect('/admin/login')
  if (state.mfaStatus === 'setup_required') redirect('/admin/mfa/setup')
  if (state.mfaStatus === 'challenge_required') redirect('/admin/mfa/verify')
  return adminSessionFromState(state)
}

export async function requireAdminMfaPage(status: Exclude<AdminMfaStatus, 'verified'>): Promise<AdminAuthState> {
  const state = await getAdminAuthState()
  if (!state) redirect('/admin/login')
  if (state.mfaStatus === 'verified') redirect('/admin')
  if (state.mfaStatus !== status) {
    redirect(state.mfaStatus === 'setup_required' ? '/admin/mfa/setup' : '/admin/mfa/verify')
  }
  return state
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
