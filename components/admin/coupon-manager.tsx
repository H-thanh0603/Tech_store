'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { FormField } from '@/components/admin/ui/form-field'
import { FormSection } from '@/components/admin/ui/form-section'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { useToast } from '@/components/admin/ui/toast-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setCouponActive, upsertCoupon } from '@/lib/admin/coupon-actions'
import { formatPrice } from '@/lib/format'
import type { AdminActionState, AdminCouponRow } from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }

function toLocalInput(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CouponManager({ coupons }: { coupons: AdminCouponRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState<AdminCouponRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [state, action, formPending] = useActionState(
    async (prev: AdminActionState, formData: FormData) => {
      const result = await upsertCoupon(prev, formData)
      if (result.ok) {
        toast({ title: 'Thành công', description: result.message, tone: 'success' })
        setEditing(null)
        router.refresh()
      } else {
        toast({ title: 'Thất bại', description: result.message, tone: 'error' })
      }
      return result
    },
    initial,
  )

  function fieldError(key: string) {
    if (state.ok) return undefined
    return state.fieldErrors?.[key]?.[0]
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Code</th>
              <th className="px-3 py-3 font-medium">Loại</th>
              <th className="px-3 py-3 font-medium">Giá trị</th>
              <th className="px-3 py-3 font-medium">Lượt dùng</th>
              <th className="px-3 py-3 font-medium">Hiệu lực</th>
              <th className="px-3 py-3 font-medium">TT</th>
              <th className="px-3 py-3 font-medium">
                <span className="sr-only">Hành động</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-3 py-3">{c.discountType}</td>
                <td className="px-3 py-3 tabular-nums">
                  {c.discountType === 'percentage'
                    ? `${c.discountValue}%`
                    : formatPrice(c.discountValue)}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {c.usedCount}
                  {c.usageLimit != null ? ` / ${c.usageLimit}` : ''}
                </td>
                <td className="px-3 py-3 text-(length:--text-xs) text-fg-muted">
                  {c.startsAt ? new Date(c.startsAt).toLocaleString('vi-VN') : '—'}
                  <br />
                  {c.endsAt ? new Date(c.endsAt).toLocaleString('vi-VN') : '—'}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge
                    status={c.isActive ? 'active' : 'inactive'}
                    label={c.isActive ? 'active' : 'inactive'}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="min-h-10 rounded px-2 text-accent hover:bg-accent-subtle"
                      onClick={() => setEditing(c)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="min-h-10 rounded px-2 text-fg-muted hover:bg-surface-muted"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await setCouponActive(c.id, !c.isActive)
                          toast({
                            title: result.ok ? 'Thành công' : 'Thất bại',
                            description: result.message,
                            tone: result.ok ? 'success' : 'error',
                          })
                          router.refresh()
                        })
                      }
                    >
                      {c.isActive ? 'Tắt' : 'Bật'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-fg-muted">
                  Chưa có coupon.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <FormSection
        title={editing ? `Sửa ${editing.code}` : 'Tạo coupon'}
        description="Code được normalize UPPERCASE. Checkout là nguồn sự thật khi áp dụng."
      >
        <form action={action} className="space-y-3" key={editing?.id ?? 'new'}>
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Input
            id="code"
            name="code"
            label="Code"
            required
            defaultValue={editing?.code ?? ''}
            error={fieldError('code')}
          />
          <FormField id="discountType" label="Loại giảm">
            <select
              id="discountType"
              name="discountType"
              defaultValue={editing?.discountType ?? 'percentage'}
              className="min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount (VND)</option>
            </select>
          </FormField>
          <Input
            id="discountValue"
            name="discountValue"
            type="number"
            label="Giá trị giảm"
            required
            defaultValue={editing?.discountValue ?? 10}
            error={fieldError('discountValue')}
          />
          <Input
            id="minimumOrder"
            name="minimumOrder"
            type="number"
            label="Đơn tối thiểu"
            defaultValue={editing?.minimumOrder ?? 0}
          />
          <Input
            id="maximumDiscount"
            name="maximumDiscount"
            type="number"
            label="Giảm tối đa (optional)"
            defaultValue={editing?.maximumDiscount ?? ''}
          />
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            label="Bắt đầu"
            defaultValue={toLocalInput(editing?.startsAt ?? null)}
          />
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            label="Kết thúc"
            defaultValue={toLocalInput(editing?.endsAt ?? null)}
            error={fieldError('endsAt')}
          />
          <Input
            id="usageLimit"
            name="usageLimit"
            type="number"
            label="Giới hạn lượt dùng"
            defaultValue={editing?.usageLimit ?? ''}
          />
          <label className="inline-flex items-center gap-2 text-(length:--text-sm)">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={editing?.isActive ?? true}
              className="size-4"
            />
            Active
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={formPending}>
              {formPending ? 'Đang lưu…' : 'Lưu'}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Hủy sửa
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>
    </div>
  )
}
