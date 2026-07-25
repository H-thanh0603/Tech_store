import Link from 'next/link'
import { notFound } from 'next/navigation'

import { OrderActionsForm } from '@/components/admin/order-actions-form'
import { OrderNotesPanel } from '@/components/admin/order-notes-form'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { getAdminOrder } from '@/lib/admin/queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { formatPrice } from '@/lib/format'

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const access = await requireAdminModule('orders')
  if (isForbidden(access)) return <PermissionDeniedState />

  const { code } = await params
  const order = await getAdminOrder(decodeURIComponent(code))
  if (!order) notFound()

  return (
    <section className="space-y-8">
      <PageHeader
        title={order.orderCode}
        description={`Đặt lúc ${new Date(order.createdAt).toLocaleString('vi-VN')}${
          order.updatedAt ? ` · Cập nhật ${new Date(order.updatedAt).toLocaleString('vi-VN')}` : ''
        }`}
        actions={
          <Link href="/admin/orders" className="text-(length:--text-sm) text-accent hover:underline">
            ← Đơn hàng
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-(--radius-lg) border border-border bg-surface-raised p-4 shadow-(--shadow-sm)">
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
                <dt className="text-fg-muted">Ghi chú khách</dt>
                <dd>{order.note}</dd>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <StatusBadge status={order.orderStatus} />
              <StatusBadge status={order.paymentStatus} />
              <StatusBadge status="draft" label={order.paymentMethod} />
            </div>
          </dl>
        </div>

        <OrderActionsForm
          orderCode={order.orderCode}
          orderStatus={order.orderStatus}
          paymentStatus={order.paymentStatus}
        />
      </div>

      <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <caption className="sr-only">Snapshot sản phẩm trong đơn</caption>
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-4 py-3">Sản phẩm (snapshot)</th>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ml-auto w-full max-w-sm space-y-1 rounded-(--radius-lg) border border-border bg-surface-raised p-4 text-(length:--text-sm) shadow-(--shadow-sm)">
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

        <div className="rounded-(--radius-lg) border border-border bg-surface-raised p-4 shadow-(--shadow-sm)">
          <h2 className="mb-3 font-semibold">Timeline trạng thái</h2>
          {(order.statusEvents?.length ?? 0) === 0 ? (
            <p className="text-(length:--text-sm) text-fg-muted">
              Chưa có event (các thay đổi sau migration sẽ được ghi).
            </p>
          ) : (
            <ol className="space-y-3">
              {order.statusEvents?.map((event) => (
                <li key={event.id} className="border-l-2 border-accent pl-3 text-(length:--text-sm)">
                  <div className="font-medium">
                    {event.eventType === 'payment_status' ? 'Thanh toán' : 'Đơn'}:{' '}
                    {event.fromStatus ?? '—'} → {event.toStatus}
                  </div>
                  {event.reason ? (
                    <p className="text-fg-muted">Lý do: {event.reason}</p>
                  ) : null}
                  <p className="text-(length:--text-xs) text-fg-subtle">
                    {event.actorLabel} · {new Date(event.createdAt).toLocaleString('vi-VN')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <OrderNotesPanel orderCode={order.orderCode} notes={order.internalNotes ?? []} />
    </section>
  )
}
