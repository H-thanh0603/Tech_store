import Link from 'next/link'

import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { ReturnsTable } from '@/components/admin/returns-table'
import { requireAdminPermission } from '@/lib/admin/auth'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

interface ReturnRow {
  id: string
  order_id: string
  orderCode: string
  orderStatus: string
  customerName: string
  requestedByPhone: string
  reasonCode: string
  customerNote: string | null
  status: string
  refundAmount: string | null
  adminNote: string | null
  decidedAt: string | null
  decidedByLabel: string | null
  createdAt: string
  orderTotal: string
  paymentMethod: string
  paymentStatus: string
  itemCount: number
}

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await requireAdminModule('orders')
  if (isForbidden(access)) return <PermissionDeniedState />

  // Listing is module-scoped, but deciding is permission-scoped: staff can
  // see the queue, only admin/manager can act on it.
  let canDecide = true
  try {
    await requireAdminPermission('orders.return')
  } catch {
    canDecide = false
  }

  const params = await searchParams
  const statusParam = typeof params.status === 'string' ? params.status : 'requested'
  const status = ['requested', 'approved', 'rejected', 'all'].includes(statusParam)
    ? statusParam
    : 'requested'

  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_returns', {
    p_status: status,
    p_page: 1,
    p_page_size: 50,
  })
  const root = (data ?? {}) as { rows?: Array<Record<string, unknown>>; total?: number }
  // RPC returns snake_case (row_to_json); normalize to the camelCase shape
  // ReturnsTable expects. Missing mapping renders "Invalid Date · sp" rows.
  const rows: ReturnRow[] = error
    ? []
    : (root.rows ?? []).map((r) => ({
        id: String(r.id),
        order_id: String(r.order_id),
        orderCode: String(r.order_code),
        orderStatus: String(r.order_status),
        customerName: String(r.customer_name),
        requestedByPhone: String(r.requested_by_phone),
        reasonCode: String(r.reason_code),
        customerNote: r.customer_note == null ? null : String(r.customer_note),
        status: String(r.status),
        refundAmount: r.refund_amount == null ? null : String(r.refund_amount),
        adminNote: r.admin_note == null ? null : String(r.admin_note),
        decidedAt: r.decided_at == null ? null : String(r.decided_at),
        decidedByLabel: r.decided_by_label == null ? null : String(r.decided_by_label),
        createdAt: String(r.created_at),
        orderTotal: String(r.order_total),
        paymentMethod: String(r.payment_method),
        paymentStatus: String(r.payment_status),
        itemCount: Number(r.item_count) || 0,
      }))

  return (
    <section className="space-y-6">
      <PageHeader
        title="Yêu cầu trả hàng"
        description={
          error
            ? 'Không tải được danh sách trả hàng.'
            : `${root.total ?? rows.length} yêu cầu · duyệt sẽ hoàn tồn kho và ghi audit log`
        }
        actions={
          <Link
            href="/admin/orders"
            className="text-(length:--text-sm) text-accent hover:underline"
          >
            ← Đơn hàng
          </Link>
        }
      />

      <nav aria-label="Lọc trạng thái" className="flex flex-wrap gap-2">
        {(['requested', 'approved', 'rejected', 'all'] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/orders/returns?status=${s}`}
            className={`inline-flex min-h-10 items-center rounded-(--radius-md) border px-3 text-(length:--text-sm) font-medium ${
              s === status
                ? 'border-brand bg-accent-subtle text-accent'
                : 'border-border text-fg-muted hover:bg-surface-muted'
            }`}
          >
            {s === 'requested' ? 'Chờ xử lý' : s === 'approved' ? 'Đã duyệt' : s === 'rejected' ? 'Từ chối' : 'Tất cả'}
          </Link>
        ))}
      </nav>

      {canDecide ? (
        <ReturnsTable rows={rows} />
      ) : (
        <div className="space-y-3">
          <p className="rounded-(--radius-md) border border-warning/40 bg-warning/10 px-3 py-2 text-(length:--text-sm) text-warning">
            Vai trò của bạn chỉ được xem, không được duyệt trả hàng.
          </p>
          <ReturnsTable rows={[]} />
        </div>
      )}
    </section>
  )
}
