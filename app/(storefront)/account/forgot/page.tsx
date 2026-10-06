import type { Metadata } from 'next'

import { ForgotPasswordClient } from '@/components/account/reset-client'

export const metadata: Metadata = {
  title: 'Quên mật khẩu',
  description: 'Nhận link đặt lại mật khẩu tài khoản TechStore.',
}

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <div className="container-store py-10 sm:py-14">
      {params.error === 'expired' ? (
        <p className="mx-auto mb-4 max-w-md rounded-(--radius-md) bg-danger-subtle px-3 py-2 text-(length:--text-sm) text-danger">
          Link đã hết hạn hoặc không hợp lệ. Hãy gửi lại yêu cầu.
        </p>
      ) : null}
      <ForgotPasswordClient />
    </div>
  )
}
