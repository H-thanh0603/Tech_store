'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { FormField } from '@/components/admin/ui/form-field'
import { FormSection } from '@/components/admin/ui/form-section'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { useToast } from '@/components/admin/ui/toast-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adjustInventory } from '@/lib/admin/catalog-actions'
import type {
  AdminActionState,
  InventoryAdjustmentRow,
  InventoryListRow,
} from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }

const REASONS = [
  { value: 'restock', label: 'Nhập thêm (restock)' },
  { value: 'correction', label: 'Kiểm kê / correction' },
  { value: 'damaged', label: 'Hư hỏng (damaged)' },
  { value: 'returned', label: 'Hoàn hàng (returned)' },
  { value: 'manual_adjustment', label: 'Điều chỉnh tay' },
] as const

export function InventoryTable({ rows }: { rows: InventoryListRow[] }) {
  return (
    <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
      <table className="min-w-full text-left text-(length:--text-sm)">
        <thead className="bg-surface-muted text-fg-muted">
          <tr>
            <th className="px-3 py-3 font-medium">Sản phẩm</th>
            <th className="px-3 py-3 font-medium">SKU</th>
            <th className="px-3 py-3 font-medium">On-hand</th>
            <th className="px-3 py-3 font-medium">Reserved</th>
            <th className="px-3 py-3 font-medium">Available</th>
            <th className="px-3 py-3 font-medium">Ngưỡng</th>
            <th className="px-3 py-3 font-medium">TT</th>
            <th className="px-3 py-3 font-medium">
              <span className="sr-only">Điều chỉnh</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.variantId} className="border-t border-border align-top">
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.imageUrl}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 rounded border border-border object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <Link
                      href={`/admin/products/${row.productId}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {row.productName}
                    </Link>
                    <p className="text-(length:--text-xs) text-fg-subtle">
                      {row.categoryName ?? '—'} · {row.brandName ?? '—'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 font-mono text-(length:--text-xs)">{row.sku}</td>
              <td className="px-3 py-3 tabular-nums">{row.onHand}</td>
              <td className="px-3 py-3 tabular-nums">{row.reserved}</td>
              <td className="px-3 py-3 tabular-nums font-semibold">{row.available}</td>
              <td className="px-3 py-3 tabular-nums">{row.threshold}</td>
              <td className="px-3 py-3">
                <StatusBadge
                  status={row.stockStatus}
                  label={
                    row.stockStatus === 'out_of_stock'
                      ? 'Hết hàng'
                      : row.stockStatus === 'low_stock'
                        ? 'Sắp hết'
                        : 'Còn hàng'
                  }
                />
              </td>
              <td className="px-3 py-3">
                <Link
                  href={`/admin/inventory?variant=${row.variantId}`}
                  className="inline-flex min-h-10 items-center rounded px-2 text-accent hover:bg-accent-subtle"
                >
                  Điều chỉnh
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function InventoryAdjustPanel({
  row,
  history,
}: {
  row: InventoryListRow
  history: InventoryAdjustmentRow[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [state, action, pending] = useActionState(
    async (prev: AdminActionState, formData: FormData) => {
      const result = await adjustInventory(prev, formData)
      if (result.ok) {
        toast({ title: 'Thành công', description: result.message, tone: 'success' })
        router.refresh()
      } else {
        toast({ title: 'Thất bại', description: result.message, tone: 'error' })
      }
      return result
    },
    initial,
  )
  const [mode, setMode] = useState<'restock' | 'reduce' | 'set'>('restock')

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FormSection
        title={`Điều chỉnh · ${row.sku}`}
        description={`${row.productName}. On-hand ${row.onHand}, reserved ${row.reserved}, available ${row.available}.`}
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="variantId" value={row.variantId} />
          <input type="hidden" name="expectedQuantity" value={row.onHand} />
          <input type="hidden" name="mode" value={mode} />

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['restock', 'Nhập thêm'],
                ['reduce', 'Giảm / kiểm kê'],
                ['set', 'Đặt tuyệt đối'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-3 py-1 text-(length:--text-sm) ${
                  mode === value ? 'bg-accent text-accent-fg' : 'bg-surface-muted text-fg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Input
            id="amount"
            name="amount"
            type="number"
            min={1}
            label={mode === 'set' ? 'Số lượng mới (on-hand)' : 'Số lượng thay đổi'}
            required
            defaultValue={1}
          />

          <FormField id="reasonCode" label="Lý do" required>
            <select
              id="reasonCode"
              name="reasonCode"
              required
              className="min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
              defaultValue={mode === 'restock' ? 'restock' : 'correction'}
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </FormField>

          <Input id="note" name="note" label="Ghi chú" />
          <Input
            id="threshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            label="Ngưỡng cảnh báo (tuỳ chọn)"
            defaultValue={row.threshold}
          />

          {!state.ok ? (
            <p className="text-(length:--text-sm) text-danger" role="alert">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? 'Đang lưu…' : 'Xác nhận điều chỉnh'}
          </Button>
          <p className="text-(length:--text-xs) text-fg-muted">
            Optimistic lock theo on-hand hiện tại. Available không được âm sau điều chỉnh.
          </p>
        </form>
      </FormSection>

      <FormSection title="Lịch sử điều chỉnh" description="Gần nhất trước.">
        {history.length === 0 ? (
          <p className="text-(length:--text-sm) text-fg-muted">Chưa có bản ghi.</p>
        ) : (
          <ul className="divide-y divide-border text-(length:--text-sm)">
            {history.map((h) => (
              <li key={h.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-semibold tabular-nums ${
                      h.delta > 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>
                  <span className="text-fg-muted">
                    {h.previousQuantity} → {h.newQuantity}
                  </span>
                  <StatusBadge status="draft" label={h.reasonCode} />
                </div>
                <p className="mt-1 text-(length:--text-xs) text-fg-subtle">
                  {new Date(h.createdAt).toLocaleString('vi-VN')} · {h.actorLabel}
                  {h.note ? ` · ${h.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  )
}
