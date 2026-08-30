'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { decideReturn } from '@/lib/admin/order-actions'
import type { AdminActionState } from '@/lib/admin/types'

interface ReturnRow {
  id: string
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

const REASON_LABELS: Record<string, string> = {
  defective: 'Lỗi / hỏng',
  wrong_item: 'Nhận sai sản phẩm',
  not_as_described: 'Không đúng mô tả',
  changed_mind: 'Đổi ý',
  other: 'Khác',
}

export function ReturnsTable({ rows }: { rows: ReturnRow[] }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    decideReturn,
    { ok: true },
  )
  const [expanded, setExpanded] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <p className="rounded-(--radius-md) border border-dashed border-border-strong px-4 py-8 text-center text-(length:--text-sm) text-fg-muted">
        Không có yêu cầu trả hàng ở trạng thái này.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {state.ok === false ? (
        <p className="rounded-(--radius-md) border border-danger/40 bg-danger/10 px-3 py-2 text-(length:--text-sm) text-danger">
          {state.message}
        </p>
      ) : null}
      {state.ok === true && state.message ? (
        <p className="rounded-(--radius-md) border border-success/40 bg-success/10 px-3 py-2 text-(length:--text-sm) text-success">
          {state.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <caption className="sr-only">Yêu cầu trả hàng</caption>
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Đơn</th>
              <th className="px-3 py-3 font-medium">Khách</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">Lý do</th>
              <th className="px-3 py-3 font-medium">Trạng thái</th>
              <th className="px-3 py-3 font-medium">
                <span className="sr-only">Hành động</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top hover:bg-surface-muted/40">
                <td className="px-3 py-3">
                  <p className="font-medium text-fg">{r.orderCode}</p>
                  <p className="text-(length:--text-xs) text-fg-subtle">
                    {new Date(r.createdAt).toLocaleString('vi-VN')} · {r.itemCount} sp
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p>{r.customerName}</p>
                  <p className="text-(length:--text-xs) text-fg-subtle">{r.requestedByPhone}</p>
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <p>{REASON_LABELS[r.reasonCode] ?? r.reasonCode}</p>
                  {r.customerNote ? (
                    <p className="max-w-48 truncate text-(length:--text-xs) text-fg-subtle" title={r.customerNote}>
                      {r.customerNote}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={
                      r.status === 'approved'
                        ? 'text-success'
                        : r.status === 'rejected'
                          ? 'text-danger'
                          : 'text-warning'
                    }
                  >
                    {r.status === 'approved' ? 'Đã duyệt' : r.status === 'rejected' ? 'Từ chối' : 'Chờ xử lý'}
                  </span>
                  {r.refundAmount ? (
                    <p className="text-(length:--text-xs) text-fg-subtle">
                      Hoàn: {Number(r.refundAmount).toLocaleString('vi-VN')}₫
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  {r.status === 'requested' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      {expanded === r.id ? 'Đóng' : 'Xử lý'}
                    </Button>
                  ) : (
                    <span className="text-(length:--text-xs) text-fg-subtle">
                      {r.decidedByLabel ? `bởi ${r.decidedByLabel}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expanded ? (
        <DecideForm
          formAction={formAction}
          pending={pending}
          row={rows.find((r) => r.id === expanded)!}
          onDone={() => {
            setExpanded(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function DecideForm({
  formAction,
  pending,
  row,
  onDone,
}: {
  formAction: (payload: FormData) => void
  pending: boolean
  row: ReturnRow
  onDone: () => void
}) {
  return (
    <form action={formAction} className="space-y-3 rounded-(--radius-md) border border-border bg-surface-raised p-4">
      <input type="hidden" name="returnId" value={row.id} />
      <input type="hidden" name="orderCode" value={row.orderCode} />
      <div>
        <label htmlFor="refundAmount" className="block text-(length:--text-sm) font-medium text-fg">
          Số tiền hoàn (₫, để trống nếu chưa hoàn)
        </label>
        <input
          id="refundAmount"
          name="refundAmount"
          type="number"
          min="0"
          step="1000"
          placeholder={String(Math.round(Number(row.orderTotal)))}
          className="mt-1 min-h-11 w-full max-w-64 rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) text-fg"
        />
      </div>
      <div>
        <label htmlFor="adminNote" className="block text-(length:--text-sm) font-medium text-fg">
          Ghi chú quyết định
        </label>
        <textarea
          id="adminNote"
          name="adminNote"
          rows={2}
          maxLength={1000}
          className="mt-1 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 py-2 text-(length:--text-sm) text-fg"
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-(length:--text-sm) text-fg">
        <input type="checkbox" name="restock" value="true" defaultChecked className="size-4" />
        Nhập lại tồn kho (bỏ chọn nếu hàng hỏng không bán lại)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          {pending ? 'Đang xử lý…' : 'Duyệt trả hàng'}
        </Button>
        <Button type="submit" name="decision" value="reject" variant="secondary" disabled={pending}>
          Từ chối
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Đóng
        </Button>
      </div>
    </form>
  )
}
