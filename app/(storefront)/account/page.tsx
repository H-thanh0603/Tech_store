import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccountDashboardClient } from '@/components/account/account-client'
import { deleteMyDataAction } from '@/lib/customer/data-actions'
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

      <section
        aria-labelledby="gdpr-heading"
        className="mx-auto mt-10 max-w-3xl rounded-(--radius-lg) border border-border bg-surface-raised p-5"
      >
        <h2 id="gdpr-heading" className="text-(length:--text-base) font-semibold text-fg">
          Dữ liệu của bạn
        </h2>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">
          Tải xuống toàn bộ dữ liệu tài khoản, hoặc yêu cầu xóa. Đơn hàng đã đặt được giữ
          ẩn danh cho mục đích bảo hành/thuế.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/account/export"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold text-fg hover:border-brand/50"
          >
            Tải dữ liệu (JSON)
          </a>
          <form action={deleteMyDataAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-danger/40 bg-danger-subtle px-4 text-(length:--text-sm) font-semibold text-danger hover:border-danger"
            >
              Xóa dữ liệu tài khoản
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
