import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ResetPasswordClient } from '@/components/account/reset-client'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export const metadata: Metadata = {
  title: 'Đặt mật khẩu mới',
  description: 'Đặt lại mật khẩu tài khoản TechStore.',
}

export default async function ResetPage() {
  // Chỉ session vừa đổi từ recovery link mới thấy form (route /auth/reset
  // đã exchange code). Không session → về xin link mới.
  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/account/forgot?error=expired')

  return (
    <div className="container-store py-10 sm:py-14">
      <ResetPasswordClient />
    </div>
  )
}
