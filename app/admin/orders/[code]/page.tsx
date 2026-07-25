import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { OrderActionsForm } from '@/components/admin/order-actions-form'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { getAdminOrder } from '@/lib/admin/queries'
import { formatPrice } from '@/lib/format'

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const { code } = await params
  const order = await getAdminOrder(decodeURIComponent(code))
  if (!order) notFound()

  return (
    <section className="space-y-8">
      <div>
        <Link href="/admin/orders" className="text-(length:--text-sm) text-accent hover:underline">
          ← Đơn hàng
        </Link>
        <h1 className="mt-2 text-(length:--text-2xl) font-semibold">{order.orderCode}</h1>
        <p className="text-(length:--text-sm) text-fg-muted">
          {new Date(order.createdAt).toLocaleString('vi-VN')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-(--radius-lg) border border-border p-4">
          <h2 className="font-semibold">Khách hàng</h2>
          <dl className="space-y-1 text-(length:--text-sm)">
            <div>
              <dt className="text-fg-muted">Tên</dt>
              <dd>{order.customerName}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Điện thoại</dt>
              <dd>{order.customerPhone}</dd>
            </div>
            {order.customerEmail ? (
              <div>
                <dt className="text-fg-muted">Email</dt>
                <dd>{order.customerEmail}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-fg-muted">Địa chỉ</dt>
              <dd>
                {order.address.streetAddress}, {order.address.ward}, {order.address.district},{' '}
                {order.address.province}
              </dd>
            </div>
            {order.note ? (
              <div>
                <dt className="text-fg-muted">Ghi chú</dt>
                <dd>{order.note}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <OrderActionsForm
          orderCode={order.orderCode}
          orderStatus={order.orderStatus}
          paymentStatus={order.paymentStatus}
        />
      </div>

      <div className="overflow-x-auto rounded-(--radius-lg) border border-border">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">SL</th>
              <th className="px-4 py-3">Đơn giá</th>
              <th className="px-4 py-3">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={`${item.sku}-${idx}`} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{item.productName}</div>
                  <div className="text-(length:--text-xs) text-fg-subtle">
                    {Object.entries(item.attributes)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </div>
                </td>
                <td className="px-4 py-3">{item.sku}</td>
                <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                <td className="px-4 py-3 tabular-nums">{formatPrice(item.unitPrice)}</td>
                <td className="px-4 py-3 tabular-nums">{formatPrice(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto max-w-sm space-y-1 text-(length:--text-sm)">
        <div className="flex justify-between">
          <span className="text-fg-muted">Tạm tính</span>
          <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-fg-muted">
            Giảm giá{order.couponCode ? ` (${order.couponCode})` : ''}
          </span>
          <span className="tabular-nums">-{formatPrice(order.discountTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-fg-muted">Ship</span>
          <span className="tabular-nums">{formatPrice(order.shippingTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-(length:--text-base) font-semibold">
          <span>Tổng</span>
          <span className="tabular-nums">{formatPrice(order.total)}</span>
        </div>
      </div>
    </section>
  )
}
