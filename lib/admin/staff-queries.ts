import { requireAdminPermission } from '@/lib/admin/auth'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminStaffAccountRow } from '@/lib/admin/types'

export async function listStaffAccounts(): Promise<AdminStaffAccountRow[]> {
  await requireAdminPermission('staff.manage')
  const db = getSupabaseAdminClient()
  const [{ data: profiles, error: profileError }, { data: authData, error: authError }] =
    await Promise.all([
      db
        .from('admin_users')
        .select('user_id, display_name, role, is_active, created_at, updated_at, disabled_at')
        .order('created_at'),
      // ponytail: one page covers a retail workforce; paginate when staff exceeds 1,000.
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

  if (profileError || authError) throw new Error('STAFF_LIST_FAILED')
  const users = new Map(authData.users.map((user) => [user.id, user]))

  return (profiles ?? []).map((profile) => {
    const user = users.get(String(profile.user_id))
    return {
      userId: String(profile.user_id),
      email: user?.email ?? '—',
      displayName: String(profile.display_name),
      role: profile.role as AdminStaffAccountRow['role'],
      isActive: Boolean(profile.is_active),
      createdAt: String(profile.created_at),
      updatedAt: String(profile.updated_at),
      disabledAt: profile.disabled_at ? String(profile.disabled_at) : null,
      lastSignInAt: user?.last_sign_in_at ?? null,
      mfaVerified: Boolean(user?.factors?.some((factor) => factor.status === 'verified')),
    }
  })
}
