import Link from 'next/link'

import { DataTable, type DataTableColumn } from '@/components/admin/ui/data-table'
import { ErrorState } from '@/components/admin/ui/error-state'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { listAdminOrders } from '@/lib/admin/queries'
import type { AdminOrderListItem } from '@/lib/admin/types'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/commerce/types'
import { formatPrice } from '@/lib/format'

const ORDER_STATUSES: Array<OrderStatus | 'all'> = [
  'all',
  'pending',
  'awaiting_payment',
  'confirmed',
  'packing',
  'shipping',
  'completed',
  'cancelled',
  'expired',
]

function buildQs(parts: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(parts)) {
    if (v === undefined || v === '' || v === 'all') continue
    if (k === 'page' && Number(v) <= 1) continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await requireAdminModule('orders')
  if (isForbidden(access)) return <PermissionDeniedState />

  const raw = await searchParams
  const get = (key: string) => {
    const v = raw[key]
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
  }

  const q = get('q').trim()
  const status = (ORDER_STATUSES.includes(get('status') as OrderStatus | 'all')
    ? get('status')
    : 'all') as OrderStatus | 'all'
  const paymentStatus = (
    ['all', 'pending', 'paid', 'failed', 'expired'].includes(get('paymentStatus'))
      ? get('paymentStatus')
      : 'all'
  ) as PaymentStatus | 'all'
  const paymentMethod = (
    ['all', 'cod', 'bank_transfer'].includes(get('paymentMethod'))
      ? get('paymentMethod')
      : 'all'
  ) as PaymentMethod | 'all'
  const dateFrom = get('dateFrom')
  const dateTo = get('dateTo')
  const sort = (
    ['created_at', 'total', 'updated_at'].includes(get('sort')) ? get('sort') : 'created_at'
  ) as 'created_at' | 'total' | 'updated_at'
  const dir = get('dir') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(get('page') || '1', 10) || 1)

  let result
  let error: string | null = null
  try {
    result = await listAdminOrders({
      q: q || undefined,
      status,
      paymentStatus,
      paymentMethod,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
      sort,
      dir,
      page,
      pageSize: 20,
    })
  } catch {
    error = 'Không tải được đơn hàng. Kiểm tra migration admin_list_orders.'
  }

  const filters = { q, status, paymentStatus, paymentMethod, dateFrom, dateTo, sort, dir }

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
      header: 'Ngày đặt',
      hideOnMobile: true,
      className: 'text-fg-muted',
      cell: (o) => new Date(o.createdAt).toLocaleString('vi-VN'),
    },
  ]

  return (
    <section>
      <PageHeader
        title="Đơn hàng"
        description={
          result
            ? `${result.total} đơn · trang ${result.page}/${result.pageCount}`
            : 'Quản lý đơn hàng'
        }
      />

      <form method="get" action="/admin/orders" className="mb-4 space-y-3">
        <FilterBar
          actions={
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-accent px-3 text-(length:--text-sm) font-semibold text-accent-fg"
            >
              Lọc
            </button>
          }
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Mã / tên / SĐT"
            className="min-h-(--size-touch) w-full max-w-xs rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Tìm đơn"
          />
          <select
            name="paymentStatus"
            defaultValue={paymentStatus}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="TT thanh toán"
          >
            <option value="all">Mọi payment</option>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="failed">failed</option>
            <option value="expired">expired</option>
          </select>
          <select
            name="paymentMethod"
            defaultValue={paymentMethod}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Phương thức"
          >
            <option value="all">Mọi method</option>
            <option value="cod">COD</option>
            <option value="bank_transfer">Chuyển khoản</option>
          </select>
          <input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Từ ngày"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Đến ngày"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Sắp xếp"
          >
            <option value="created_at">Ngày đặt</option>
            <option value="updated_at">Cập nhật</option>
            <option value="total">Tổng tiền</option>
          </select>
          <select
            name="dir"
            defaultValue={dir}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Chiều"
          >
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </select>
          {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
        </FilterBar>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {ORDER_STATUSES.map((value) => (
          <FilterChip
            key={value}
            href={`/admin/orders${buildQs({ ...filters, status: value, page: 1 })}`}
            active={status === value}
          >
            {value === 'all' ? 'Tất cả' : value}
          </FilterChip>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : null}

      {!error && result ? (
        <DataTable
          caption="Danh sách đơn hàng"
          columns={columns}
          rows={result.rows}
          getRowId={(o) => o.orderCode}
          emptyTitle="Không có đơn"
          emptyDescription="Thử đổi bộ lọc hoặc khoảng ngày."
          totalCount={result.total}
          page={result.page}
          pageCount={result.pageCount}
          hrefForPage={(p) => `/admin/orders${buildQs({ ...filters, page: p })}`}
        />
      ) : null}
    </section>
  )
}
