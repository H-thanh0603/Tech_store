'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { issueInvoice } from '@/lib/admin/order-actions'
import type { AdminActionState } from '@/lib/admin/types'

export function InvoiceForm({ orderCode }: { orderCode: string }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    issueInvoice,
    { ok: true },
  )
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Xuất hóa đơn VAT
      </Button>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-(--radius-lg) border border-border bg-surface-raised p-4">
      <input type="hidden" name="orderCode" value={orderCode} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="invoice-taxCode" className="block text-(length:--text-sm) font-medium text-fg">
            Mã số thuế (tùy chọn)
          </label>
          <input
            id="invoice-taxCode"
            name="taxCode"
            type="text"
            inputMode="numeric"
            maxLength={14}
            placeholder="0312345678"
            className="mt-1 min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) text-fg"
          />
        </div>
        <div>
          <label htmlFor="invoice-company" className="block text-(length:--text-sm) font-medium text-fg">
            Tên công ty (tùy chọn)
          </label>
          <input
            id="invoice-company"
            name="companyName"
            type="text"
            maxLength={200}
            placeholder="Công ty TNHH…"
            className="mt-1 min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 text-(length:--text-sm) text-fg"
          />
        </div>
      </div>
      <p className="text-(length:--text-xs) text-fg-muted">
        Hóa đơn nội bộ INV-YYYYMMDD-######, VAT 10% tách từ tổng đơn. Khách lẻ bỏ trống MST.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang xuất…' : 'Xuất hóa đơn'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Đóng
        </Button>
      </div>
      {state.ok === false ? (
        <p className="text-(length:--text-sm) text-danger">{state.message}</p>
      ) : null}
      {state.ok === true && state.message ? (
        <p className="text-(length:--text-sm) text-success">{state.message}</p>
      ) : null}
    </form>
  )
}
