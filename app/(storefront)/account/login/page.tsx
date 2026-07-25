import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccountLoginClient } from '@/components/account/account-client'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export const metadata: Metadata = {
  title: 'Đăng nhập',
  description: 'Đăng nhập TechStore bằng magic link hoặc mật khẩu.',
}

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/account')

  const params = await searchParams

  return (
    <div className="container-store py-10 sm:py-14">
      {params.error === 'auth' ? (
        <p className="mx-auto mb-4 max-w-md rounded-(--radius-md) bg-danger-subtle px-3 py-2 text-(length:--text-sm) text-danger">
          Không xác thực được magic link. Thử gửi lại.
        </p>
      ) : null}
      <AccountLoginClient />
    </div>
  )
}
