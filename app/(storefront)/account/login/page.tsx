import type { Metadata } from 'next'

import { AccountLoginClient } from '@/components/account/account-client'

export const metadata: Metadata = {
  title: 'Đăng nhập',
  description: 'Đăng nhập hoặc tạo tài khoản TechStore trên thiết bị của bạn.',
}

export default function AccountLoginPage() {
  return (
    <div className="container-store py-10 sm:py-14">
      <AccountLoginClient />
    </div>
  )
}
