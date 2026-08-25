import {
  canAccessModule,
  canPerform,
  isAdminRole,
  type AdminModule,
  type AdminPermission,
  type AdminRole,
} from '@/lib/admin/permissions'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export type AdminSession = {
  userId: string
  role: AdminRole
  displayName: string
  email: string
  actorLabel: string
}

export type AdminMfaStatus = 'setup_required' | 'challenge_required' | 'verified'
export type AdminAuthState = AdminSession & { mfaStatus: AdminMfaStatus }

export function adminSessionFromState(state: AdminAuthState): AdminSession {
  return {
    userId: state.userId,
    role: state.role,
    displayName: state.displayName,
    email: state.email,
    actorLabel: state.actorLabel,
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return Boolean(await getAdminSession())
}

/**
 * Admin identity = Supabase Auth user with an active row in `admin_users`.
 * Authorization (module access) is enforced by require-admin.ts guards on
 * every page and server action; the edge proxy only refreshes sessions.
 */
export async function getAdminAuthState(): Promise<AdminAuthState | null> {
  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('admin_users')
    .select('display_name, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data || !isAdminRole(data.role)) return null

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assuranceError || !assurance?.currentLevel || !assurance.nextLevel) return null

  const mfaStatus: AdminMfaStatus = assurance.currentLevel === 'aal2'
    ? 'verified'
    : assurance.nextLevel === 'aal2'
      ? 'challenge_required'
      : 'setup_required'

  const displayName = data.display_name || user.email || user.id
  const email = user.email || ''
  return {
    userId: user.id,
    role: data.role,
    displayName,
    email,
    actorLabel: `${displayName}${email ? ` <${email}>` : ''} [${user.id}]`,
    mfaStatus,
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const state = await getAdminAuthState()
  if (!state || state.mfaStatus !== 'verified') return null
  return adminSessionFromState(state)
}

export async function requireAdminSession(module?: AdminModule): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new Error('UNAUTHORIZED')
  if (module && !canAccessModule(session.role, module)) throw new Error('FORBIDDEN')
  return session
}

export async function requireAdminPermission(permission: AdminPermission): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new Error('UNAUTHORIZED')
  if (!canPerform(session.role, permission)) throw new Error('FORBIDDEN')
  return session
}
