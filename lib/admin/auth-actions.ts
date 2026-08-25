'use server'

import { redirect } from 'next/navigation'

import { getAdminAuthState } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import type { AdminActionState } from '@/lib/admin/types'
import { adminAccountLoginSchema } from '@/lib/admin/validation'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

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
