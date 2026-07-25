import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccountDashboardClient } from '@/components/account/account-client'
import { getCompare, getWishlist } from '@/lib/customer/local-lists'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export const metadata: Metadata = {
  title: 'Tài khoản',
  description: 'Hồ sơ và lịch sử đơn hàng TechStore.',
}

export default async function AccountPage() {
  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/account/login')
  }

  const [{ data: profileRaw }, { data: ordersRaw }] = await Promise.all([
    supabase.rpc('customer_get_profile'),
    supabase.rpc('customer_list_orders'),
  ])

  const profilePayload = profileRaw as {
    code?: string
    profile?: {
      fullName: string | null
      phone: string | null
      email: string | null
      addressLine: string | null
      city: string | null
      district: string | null
      ward: string | null
    } | null
  } | null

  const ordersPayload = ordersRaw as {
    code?: string
    orders?: Array<{
      orderCode: string
      orderStatus: string
      paymentStatus: string
      paymentMethod: string
      total: number
      createdAt: string
      itemCount: number
    }>
  } | null

  const displayName =
    profilePayload?.profile?.fullName ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Khách'

  // Client-only counts — SSR defaults 0; dashboard still works
  void getCompare
  void getWishlist

  return (
    <div className="container-store py-8 sm:py-10">
      <AccountDashboardClient
        email={user.email ?? ''}
        displayName={displayName}
        profile={profilePayload?.profile ?? null}
        orders={ordersPayload?.orders ?? []}
        wishCount={0}
        compareCount={0}
      />
    </div>
  )
}
