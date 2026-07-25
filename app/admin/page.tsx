import Link from 'next/link'
import { redirect } from 'next/navigation'

import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getDashboardStats } from '@/lib/admin/queries'
import { formatPrice } from '@/lib/format'

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  let stats
  try {
    stats = await getDashboardStats()
  } catch {
    return (
      <section>
        <h1 className="text-(length:--text-2xl) font-semibold">Dashboard</h1>
        <p className="mt-4 text-danger">
          Không đọc được dữ liệu admin. Kiểm tra Supabase local và{' '}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>.
        </p>
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
    <section className="space-y-6">
      <div>
        <h1 className="text-(length:--text-2xl) font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-(length:--text-sm) text-fg-muted">Tổng quan vận hành cửa hàng.</p>
      </div>
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
