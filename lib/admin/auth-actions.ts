'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getAdminAuthState } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import type { AdminActionState } from '@/lib/admin/types'
import { adminAccountLoginSchema } from '@/lib/admin/validation'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

export async function adminLogin(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = adminAccountLoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: adminUserMessage('VALIDATION_ERROR'),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  // Rate-limit admin login 20/15min per email+IP (SEC-002) — 5 was too low for E2E (CI does >5 logins per bucket)
  try {
    const headerList = await headers()
    const ip =
      headerList.get('x-real-ip')?.trim() ||
      headerList.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
      'unknown'
    const identity = `${parsed.data.email.toLowerCase()}:${ip}`
    const { data: limited } = await getSupabaseAdminClient().rpc('check_rate_limit', {
      p_action: 'admin_login',
      p_identity: identity,
      p_limit: 20,
      p_window_minutes: 15,
    })
    if (limited === true) {
      return {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Thử quá nhiều lần. Vui lòng thử lại sau 15 phút.',
      }
    }
  } catch {
    // Rate-limit infra failure must not block admin login
  }

  const supabase = await createSupabaseAuthClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  const state = error ? null : await getAdminAuthState()
  if (!state) {
    await supabase.auth.signOut()
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Email, mật khẩu hoặc quyền admin không hợp lệ.',
    }
  }
  if (state.mfaStatus === 'setup_required') redirect('/admin/mfa/setup')
  if (state.mfaStatus === 'challenge_required') redirect('/admin/mfa/verify')
  redirect('/admin')
}

export async function adminLogout(): Promise<void> {
  const supabase = await createSupabaseAuthClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
