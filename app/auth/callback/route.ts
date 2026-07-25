import { NextResponse } from 'next/server'

import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/account'

  if (code) {
    const supabase = await createSupabaseAuthClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/account'}`)
    }
  }

  return NextResponse.redirect(`${origin}/account/login?error=auth`)
}
