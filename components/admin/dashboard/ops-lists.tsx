import Link from 'next/link'

import { StatusBadge } from '@/components/admin/ui/status-badge'
import { formatPrice } from '@/lib/format'
import type { RecentOrderRow, StockAlertRow } from '@/lib/admin/types'

export function RecentOrdersList({ orders }: { orders: RecentOrderRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {orders.map((order) => (
        <li key={order.orderCode} className="flex flex-wrap items-center gap-2 py-3">
          <div className="mr-auto min-w-0">
            <Link
              href={`/admin/orders/${order.orderCode}`}
              className="font-medium text-accent hover:underline"
            >
              {order.orderCode}
            </Link>
            <p className="truncate text-(length:--text-sm) text-fg-muted">{order.customerName}</p>
          </div>
          <StatusBadge status={order.orderStatus} />
          <span className="tabular-nums text-(length:--text-sm) font-medium">
            {formatPrice(order.total)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function StockAlertList({ items }: { items: StockAlertRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={`${item.sku}-${item.status}`} className="flex flex-wrap items-center gap-2 py-3">
          <div className="mr-auto min-w-0">
            <Link
              href={`/admin/products/${item.productId}`}
              className="font-medium text-accent hover:underline"
            >
              {item.productName}
            </Link>
            <p className="text-(length:--text-xs) text-fg-subtle">{item.sku}</p>
          </div>
          <StatusBadge
            status={item.status}
            label={item.status === 'out_of_stock' ? 'Hết hàng' : 'Sắp hết'}
          />
          <span className="tabular-nums text-(length:--text-sm)">
            {item.available} / ngưỡng {item.threshold}
          </span>
        </li>
      ))}
    </ul>
  )
}
