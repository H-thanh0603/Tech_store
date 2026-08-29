'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export type AuthFormState = {
  ok: boolean
  message?: string
  mode?: 'magic' | 'password' | 'signup'
}

// Auth endpoints are anonymous by design, so the only usable identity
// for a rate-limit bucket is the submitted email plus the caller IP
// (server actions expose headers()). Limit is 5 attempts / 15 minutes
// per identity — enough for a forgetful human, hostile to enumeration.
async function authRateLimited(
  action: 'auth_magic' | 'auth_password' | 'auth_signup',
  email: string,
): Promise<boolean> {
  try {
    const { data } = await getSupabaseServerClient().rpc('check_rate_limit', {
      p_action: action,
      p_identity: email,
      p_limit: 5,
      p_window_minutes: 15,
    })
    return data === true
  } catch {
    // Rate-limit infra failure must not lock customers out.
    return false
  }
}

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export async function signInWithMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Email không hợp lệ', mode: 'magic' }
  }

  if (await authRateLimited('auth_magic', email)) {
    return {
      ok: false,
      message: 'Bạn đã thử quá nhiều lần. Thử lại sau 15 phút.',
      mode: 'magic',
    }
  }

  const supabase = await createSupabaseAuthClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/account`,
      shouldCreateUser: true,
    },
  })
  if (error) {
    return {
      ok: false,
      message: error.message.includes('signups not allowed')
        ? 'Đăng ký email chưa bật trên Supabase. Bật Email provider trong Auth settings.'
        : error.message,
      mode: 'magic',
    }
  }
  return {
    ok: true,
    message: 'Đã gửi magic link — kiểm tra hộp thư (và spam).',
    mode: 'magic',
  }
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!email || password.length < 6) {
    return { ok: false, message: 'Email và mật khẩu (tối thiểu 6 ký tự) là bắt buộc', mode: 'password' }
  }

  if (await authRateLimited('auth_password', email)) {
    return {
      ok: false,
      message: 'Bạn đã thử quá nhiều lần. Thử lại sau 15 phút.',
      mode: 'password',
    }
  }

  const supabase = await createSupabaseAuthClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { ok: false, message: 'Email hoặc mật khẩu không đúng', mode: 'password' }
  }
  revalidatePath('/', 'layout')
  redirect('/account')
}

export async function signUpWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('fullName') ?? '').trim()
  if (!email || password.length < 6) {
    return { ok: false, message: 'Email và mật khẩu (tối thiểu 6 ký tự) là bắt buộc', mode: 'signup' }
  }

  if (await authRateLimited('auth_signup', email)) {
    return {
      ok: false,
      message: 'Bạn đã thử quá nhiều lần. Thử lại sau 15 phút.',
      mode: 'signup',
    }
  }

  const supabase = await createSupabaseAuthClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || undefined },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/account`,
    },
  })
  if (error) {
    return { ok: false, message: error.message, mode: 'signup' }
  }

  // Session may be null if email confirmation is required.
  if (data.session) {
    if (fullName) {
      await supabase.rpc('customer_upsert_profile', {
        p_profile: { fullName, email },
      })
    }
    revalidatePath('/', 'layout')
    redirect('/account')
  }

  return {
    ok: true,
    message: 'Đã tạo tài khoản. Kiểm tra email để xác nhận (nếu bật confirm), rồi đăng nhập.',
    mode: 'signup',
  }
}

export async function signOutAction() {
  const supabase = await createSupabaseAuthClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/account/login')
}

export async function saveServerProfile(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Bạn cần đăng nhập' }

  const profile = {
    fullName: String(formData.get('fullName') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim() || user.email || '',
    addressLine: String(formData.get('addressLine') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    district: String(formData.get('district') ?? '').trim(),
    ward: String(formData.get('ward') ?? '').trim(),
  }

  const { data, error } = await supabase.rpc('customer_upsert_profile', {
    p_profile: profile,
  })
  if (error) return { ok: false, message: error.message }
  const code = (data as { code?: string } | null)?.code
  if (code !== 'OK') return { ok: false, message: 'Không lưu được hồ sơ' }

  revalidatePath('/account')
  return { ok: true, message: 'Đã lưu hồ sơ trên server' }
}
