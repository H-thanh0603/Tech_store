import Link from 'next/link'
import { redirect } from 'next/navigation'

import { StatusBadge } from '@/components/admin/status-badge'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { listAdminOrders } from '@/lib/admin/queries'
import type { OrderStatus } from '@/lib/commerce/types'
import { formatPrice } from '@/lib/format'

const FILTERS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'pending' },
  { value: 'awaiting_payment', label: 'awaiting_payment' },
  { value: 'confirmed', label: 'confirmed' },
  { value: 'packing', label: 'packing' },
  { value: 'shipping', label: 'shipping' },
  { value: 'completed', label: 'completed' },
  { value: 'cancelled', label: 'cancelled' },
]

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const params = await searchParams
  const status = (FILTERS.find((f) => f.value === params.status)?.value ?? 'all') as
    | OrderStatus
    | 'all'

  const orders = await listAdminOrders({ status })

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-(length:--text-2xl) font-semibold">Đơn hàng</h1>
        <p className="text-(length:--text-sm) text-fg-muted">{orders.length} đơn (tối đa 100)</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'all' ? '/admin/orders' : `/admin/orders?status=${f.value}`}
            className={`rounded-full px-3 py-1 text-(length:--text-sm) ${
              status === f.value ? 'bg-accent text-accent-fg' : 'bg-surface-muted text-fg-muted'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-(--radius-lg) border border-border">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-4 py-3 font-medium">Khách</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Thanh toán</th>
              <th className="px-4 py-3 font-medium">Tổng</th>
              <th className="px-4 py-3 font-medium">Ngày</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.orderCode} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${o.orderCode}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {o.orderCode}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>{o.customerName}</div>
                  <div className="text-(length:--text-xs) text-fg-subtle">{o.customerPhone}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.orderStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.paymentStatus} />
                  <div className="text-(length:--text-xs) text-fg-subtle">{o.paymentMethod}</div>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatPrice(o.total)}</td>
                <td className="px-4 py-3 text-fg-muted">
                  {new Date(o.createdAt).toLocaleString('vi-VN')}
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-fg-muted">
                  Chưa có đơn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
