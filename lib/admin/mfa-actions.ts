'use server'

import { redirect } from 'next/navigation'

import { getAdminAuthState, type AdminAuthState, type AdminMfaStatus } from '@/lib/admin/auth'
import { adminLogout } from '@/lib/admin/auth-actions'
import { adminUserMessage } from '@/lib/admin/errors'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState, AdminMfaEnrollment } from '@/lib/admin/types'
import { adminMfaCodeSchema, adminMfaEnrollmentSchema } from '@/lib/admin/validation'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export { adminLogout }

function fail<T>(code: string, fieldErrors?: Record<string, string[] | undefined>): AdminActionState<T> {
  return { ok: false, code, message: adminUserMessage(code), fieldErrors }
}

async function requireState(status: Exclude<AdminMfaStatus, 'verified'>): Promise<AdminAuthState | null> {
  const state = await getAdminAuthState()
  return state?.mfaStatus === status ? state : null
}

async function writeMfaAudit(action: string, actor: AdminAuthState, payload: Record<string, unknown>) {
  return getSupabaseAdminClient().from('admin_audit_logs').insert({
    action,
    entity_type: 'staff_account',
    entity_id: actor.userId,
    payload,
    actor_label: actor.actorLabel,
    actor_user_id: actor.userId,
  })
}

export async function beginAdminMfaEnrollment(
  _prev: AdminActionState<AdminMfaEnrollment>,
  _formData: FormData,
): Promise<AdminActionState<AdminMfaEnrollment>> {
  void _prev
  void _formData
  const actor = await requireState('setup_required')
  if (!actor) return fail('MFA_STATE_CHANGED')

  const supabase = await createSupabaseAuthClient()
  const listed = await supabase.auth.mfa.listFactors()
  if (listed.error) return fail('MFA_ENROLL_FAILED')

  for (const factor of listed.data.all.filter((item) => item.status === 'unverified')) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    if (error) return fail('MFA_ENROLL_FAILED')
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'TechStore Admin',
    issuer: 'TechStore',
  })
  if (error || !data?.totp) return fail('MFA_ENROLL_FAILED')

  return {
    ok: true,
    data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
  }
}

export async function verifyAdminMfaEnrollment(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireState('setup_required')
  if (!actor) return fail('MFA_STATE_CHANGED')
  const parsed = adminMfaEnrollmentSchema.safeParse({
    factorId: formData.get('factorId'),
    code: formData.get('code'),
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const supabase = await createSupabaseAuthClient()
  const listed = await supabase.auth.mfa.listFactors()
  const ownedFactor = listed.data?.all.some(
    (factor) => factor.id === parsed.data.factorId && factor.factor_type === 'totp' && factor.status === 'unverified',
  )
  if (listed.error || !ownedFactor) return fail('MFA_STATE_CHANGED')

  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data)
  if (error) return fail('MFA_CODE_INVALID', { code: [adminUserMessage('MFA_CODE_INVALID')] })

  const audit = await writeMfaAudit('staff_mfa_enroll', actor, { factorType: 'totp' })
  if (audit.error) console.error('[admin-mfa] enrollment audit failed', audit.error.code)
  redirect('/admin')
}

export async function verifyAdminMfaChallenge(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireState('challenge_required')
  if (!actor) return fail('MFA_STATE_CHANGED')
  const parsed = adminMfaCodeSchema.safeParse(formData.get('code'))
  if (!parsed.success) return fail('VALIDATION_ERROR', { code: parsed.error.flatten().formErrors })

  const supabase = await createSupabaseAuthClient()
  const listed = await supabase.auth.mfa.listFactors()
  const factor = listed.data?.totp[0]
  if (listed.error || !factor) return fail('MFA_NOT_ENROLLED')

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data,
  })
  if (error) return fail('MFA_CODE_INVALID', { code: [adminUserMessage('MFA_CODE_INVALID')] })
  redirect('/admin')
}
