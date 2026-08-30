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
  const root = (data ?? {}) as { rows?: ReturnRow[]; total?: number }
  const rows = error ? [] : (root.rows ?? [])

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
