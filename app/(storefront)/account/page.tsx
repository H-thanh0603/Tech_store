import type { Metadata } from 'next'

import { AccountDashboardClient } from '@/components/account/account-client'

export const metadata: Metadata = {
  title: 'Tài khoản',
  description: 'Hồ sơ khách hàng, wishlist và đơn đã lưu trên thiết bị.',
}

export default function AccountPage() {
  return (
    <div className="container-store py-8 sm:py-10">
      <AccountDashboardClient />
    </div>
  )
}
