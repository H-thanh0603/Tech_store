import Link from 'next/link'

import { ErrorState } from '@/components/admin/ui/error-state'
import { PageHeader } from '@/components/admin/ui/page-header'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { getDashboardStats } from '@/lib/admin/queries'
import { formatPrice } from '@/lib/format'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'

export default async function AdminDashboardPage() {
  const access = await requireAdminModule('dashboard')
  if (isForbidden(access)) {
    return <PermissionDeniedState />
  }

  let stats
  try {
    stats = await getDashboardStats()
  } catch {
    return (
      <section>
        <PageHeader title="Tổng quan" description="Trung tâm điều hành cửa hàng." />
        <ErrorState
          message={
            'Không đọc được dữ liệu admin. Kiểm tra Supabase local và SUPABASE_SERVICE_ROLE_KEY.'
          }
        />
      </section>
    )
  }

  const cards = [
    { label: 'Đơn mới (7 ngày)', value: String(stats.newOrders7d), href: '/admin/orders' },
    { label: 'Đơn đang xử lý', value: String(stats.pendingOrders), href: '/admin/orders' },
    { label: 'Doanh thu 7 ngày', value: formatPrice(stats.revenue7d), href: '/admin/orders' },
    { label: 'Tồn thấp', value: String(stats.lowStockCount), href: '/admin/products' },
    { label: 'SP nháp', value: String(stats.draftProducts), href: '/admin/products?status=draft' },
  ]

  return (
    <section>
      <PageHeader
        title="Tổng quan"
        description="Tổng quan vận hành cửa hàng. Biểu đồ chi tiết sẽ có ở Phase 2."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm) transition-shadow hover:shadow-(--shadow-md)"
          >
            <p className="text-(length:--text-sm) text-fg-muted">{card.label}</p>
            <p className="mt-2 text-(length:--text-2xl) font-semibold tabular-nums">{card.value}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
