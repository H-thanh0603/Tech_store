import { NextResponse } from 'next/server'

import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

/**
 * Q23 — Recovery-link landing: đổi code lấy session rồi đưa về trang đặt
 * mật khẩu mới. Link 1 lần của Supabase; code sai/hết hạn → về login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseAuthClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/account/reset`)
    }
  }

  return NextResponse.redirect(`${origin}/account/forgot?error=expired`)
}
