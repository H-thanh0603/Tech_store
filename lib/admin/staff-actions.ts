'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminPermission, type AdminSession } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { staffInviteSchema, staffTargetSchema, staffUpdateSchema } from '@/lib/admin/validation'

type RpcResult = { code?: string; action?: string; revokedSessions?: number } | null

function fail(code: string, fieldErrors?: Record<string, string[] | undefined>): AdminActionState {
  return { ok: false, code, message: adminUserMessage(code), fieldErrors }
}

async function gate(): Promise<AdminSession | AdminActionState> {
  try {
    return await requireAdminPermission('staff.manage')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

function refreshStaff() {
  revalidatePath('/admin/settings')
  revalidatePath('/admin/reports/audit')
}

async function findAuthUserByEmail(email: string) {
  const { data, error } = await getSupabaseAdminClient().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (error) return { user: null, error }
  return { user: data.users.find((user) => user.email?.toLowerCase() === email) ?? null, error: null }
}

async function manageProfile(
  actor: AdminSession,
  input: { userId: string; displayName: string; role: string; isActive: boolean },
): Promise<AdminActionState> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_manage_staff_account', {
    p_actor_user_id: actor.userId,
    p_target_user_id: input.userId,
    p_display_name: input.displayName,
    p_role: input.role,
    p_is_active: input.isActive,
  })
  if (error) return fail('INTERNAL_ERROR')
  const result = data as RpcResult
  if (result?.code !== 'OK') return fail(result?.code ?? 'INTERNAL_ERROR')
  refreshStaff()
  return { ok: true, message: 'Đã cập nhật tài khoản nhân viên.' }
}

export async function inviteStaffAccount(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await gate()
  if (!('actorLabel' in actor)) return actor

  const parsed = staffInviteSchema.safeParse({
    email: formData.get('email'),
    displayName: formData.get('displayName'),
    role: formData.get('role'),
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const db = getSupabaseAdminClient()
  const existing = await findAuthUserByEmail(parsed.data.email)
  if (existing.error) return fail('INTERNAL_ERROR')

  let user = existing.user
  if (!user) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    const { data, error } = await db.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { display_name: parsed.data.displayName },
      redirectTo: siteUrl ? `${siteUrl}/auth/callback?next=/admin/login` : undefined,
    })
    if (error || !data.user) return fail('INTERNAL_ERROR')
    user = data.user
  }
  if (user.id === actor.userId) return fail('SELF_MANAGEMENT_FORBIDDEN')

  return manageProfile(actor, {
    userId: user.id,
    displayName: parsed.data.displayName,
    role: parsed.data.role,
    isActive: true,
  })
}

export async function updateStaffAccount(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await gate()
  if (!('actorLabel' in actor)) return actor
  const parsed = staffUpdateSchema.safeParse({
    userId: formData.get('userId'),
    displayName: formData.get('displayName'),
    role: formData.get('role'),
    isActive: formData.get('isActive'),
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  if (parsed.data.userId === actor.userId) return fail('SELF_MANAGEMENT_FORBIDDEN')

  const auth = getSupabaseAdminClient().auth.admin
  if (parsed.data.isActive) {
    const { error } = await auth.updateUserById(parsed.data.userId, { ban_duration: 'none' })
    if (error) return fail('AUTH_SYNC_ERROR')
  }

  const result = await manageProfile(actor, parsed.data)
  if (!result.ok || parsed.data.isActive) return result

  const { error } = await auth.updateUserById(parsed.data.userId, { ban_duration: '876000h' })
  return error ? fail('AUTH_SYNC_ERROR') : result
}

export async function revokeStaffSessions(userId: string): Promise<AdminActionState> {
  const actor = await gate()
  if (!('actorLabel' in actor)) return actor
  const parsed = staffTargetSchema.safeParse({ userId })
  if (!parsed.success) return fail('VALIDATION_ERROR')
  if (parsed.data.userId === actor.userId) return fail('SELF_MANAGEMENT_FORBIDDEN')

  const { data, error } = await getSupabaseAdminClient().rpc('admin_revoke_staff_sessions', {
    p_actor_user_id: actor.userId,
    p_target_user_id: parsed.data.userId,
  })
  if (error) return fail('INTERNAL_ERROR')
  const result = data as RpcResult
  if (result?.code !== 'OK') return fail(result?.code ?? 'INTERNAL_ERROR')
  refreshStaff()
  return { ok: true, message: `Đã thu hồi ${result.revokedSessions ?? 0} phiên đăng nhập.` }
}

export async function resetStaffMfa(userId: string): Promise<AdminActionState> {
  const actor = await gate()
  if (!('actorLabel' in actor)) return actor
  const parsed = staffTargetSchema.safeParse({ userId })
  if (!parsed.success) return fail('VALIDATION_ERROR')
  if (parsed.data.userId === actor.userId) return fail('SELF_MANAGEMENT_FORBIDDEN')

  const db = getSupabaseAdminClient()
  const listed = await db.auth.admin.mfa.listFactors({ userId: parsed.data.userId })
  if (listed.error) return fail('INTERNAL_ERROR')
  if (listed.data.factors.length === 0) return fail('MFA_NOT_ENROLLED')

  for (const factor of listed.data.factors) {
    const { error } = await db.auth.admin.mfa.deleteFactor({
      userId: parsed.data.userId,
      id: factor.id,
    })
    if (error) return fail('MFA_RESET_PARTIAL')
  }

  const revoked = await db.rpc('admin_revoke_staff_sessions', {
    p_actor_user_id: actor.userId,
    p_target_user_id: parsed.data.userId,
  })
  if (revoked.error || (revoked.data as RpcResult)?.code !== 'OK') return fail('MFA_RESET_PARTIAL')

  const audit = await db.from('admin_audit_logs').insert({
    action: 'staff_mfa_reset',
    entity_type: 'staff_account',
    entity_id: parsed.data.userId,
    payload: { removedFactors: listed.data.factors.length },
    actor_label: actor.actorLabel,
    actor_user_id: actor.userId,
  })
  if (audit.error) return fail('MFA_RESET_PARTIAL')

  refreshStaff()
  return { ok: true, message: 'Đã đặt lại MFA và thu hồi toàn bộ phiên đăng nhập.' }
}
