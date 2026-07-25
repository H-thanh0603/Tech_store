import Link from 'next/link'

import { DataTable, type DataTableColumn } from '@/components/admin/ui/data-table'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { listAdminOrders } from '@/lib/admin/queries'
import type { AdminOrderListItem } from '@/lib/admin/types'
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
  const access = await requireAdminModule('orders')
  if (isForbidden(access)) {
    return <PermissionDeniedState />
  }

  const params = await searchParams
  const status = (FILTERS.find((f) => f.value === params.status)?.value ?? 'all') as
    | OrderStatus
    | 'all'

  const orders = await listAdminOrders({ status })

  const columns: DataTableColumn<AdminOrderListItem>[] = [
    {
      id: 'code',
      header: 'Mã',
      cell: (o) => (
        <Link
          href={`/admin/orders/${o.orderCode}`}
          className="font-medium text-accent hover:underline"
        >
          {o.orderCode}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Khách',
      cell: (o) => (
        <div>
          <div>{o.customerName}</div>
          <div className="text-(length:--text-xs) text-fg-subtle">{o.customerPhone}</div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (o) => <StatusBadge status={o.orderStatus} />,
    },
    {
      id: 'payment',
      header: 'Thanh toán',
      hideOnMobile: true,
      cell: (o) => (
        <div>
          <StatusBadge status={o.paymentStatus} />
          <div className="text-(length:--text-xs) text-fg-subtle">{o.paymentMethod}</div>
        </div>
      ),
    },
    {
      id: 'total',
      header: 'Tổng',
      className: 'tabular-nums',
      cell: (o) => formatPrice(o.total),
    },
    {
      id: 'date',
      header: 'Ngày',
      hideOnMobile: true,
      className: 'text-fg-muted',
      cell: (o) => new Date(o.createdAt).toLocaleString('vi-VN'),
    },
  ]

  return (
    <section>
      <PageHeader
        title="Đơn hàng"
        description={`${orders.length} đơn (tối đa 100)`}
      />

      <DataTable
        caption="Danh sách đơn hàng"
        columns={columns}
        rows={orders}
        getRowId={(o) => o.orderCode}
        emptyTitle="Chưa có đơn"
        emptyDescription="Đơn hàng mới sẽ xuất hiện tại đây sau khi khách checkout."
        toolbar={
          <FilterBar>
            {FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                href={f.value === 'all' ? '/admin/orders' : `/admin/orders?status=${f.value}`}
                active={status === f.value}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterBar>
        }
      />
    </section>
  )
}
