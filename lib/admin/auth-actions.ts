'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ADMIN_COOKIE,
  adminAuthMode,
  adminCookieOptions,
  createAdminSessionToken,
  getAdminSession,
  secretsMatch,
} from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import type { AdminActionState } from '@/lib/admin/types'
import { adminAccountLoginSchema, adminLoginSchema } from '@/lib/admin/validation'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export async function adminLogin(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (adminAuthMode() === 'supabase') {
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
    if (error || !(await getAdminSession())) {
      await supabase.auth.signOut()
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Email, mật khẩu hoặc quyền admin không hợp lệ.',
      }
    }
    redirect('/admin')
  }

  const parsed = adminLoginSchema.safeParse({
    secret: formData.get('secret'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: adminUserMessage('VALIDATION_ERROR'),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const expected = process.env.ADMIN_SECRET
  if (!expected || expected.length < 16) {
    return {
      ok: false,
      code: 'CONFIGURATION_ERROR',
      message: adminUserMessage('CONFIGURATION_ERROR'),
    }
  }

  if (!secretsMatch(parsed.data.secret, expected)) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Mật khẩu admin không đúng.',
    }
  }

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, createAdminSessionToken(), adminCookieOptions())
  redirect('/admin')
}

export async function adminLogout(): Promise<void> {
  if (adminAuthMode() === 'supabase') {
    const supabase = await createSupabaseAuthClient()
    await supabase.auth.signOut()
    redirect('/admin/login')
  }

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, '', adminCookieOptions(0))
  redirect('/admin/login')
}
