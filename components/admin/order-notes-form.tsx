'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { addOrderInternalNote } from '@/lib/admin/order-actions'
import type { AdminActionState, OrderInternalNote } from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }

export function OrderNotesPanel({
  orderCode,
  notes,
}: {
  orderCode: string
  notes: OrderInternalNote[]
}) {
  const [state, action, pending] = useActionState(addOrderInternalNote, initial)

  return (
    <div className="space-y-4 rounded-(--radius-lg) border border-border bg-surface-raised p-4 shadow-(--shadow-sm)">
      <div>
        <h2 className="font-semibold">Ghi chú nội bộ</h2>
        <p className="text-(length:--text-xs) text-fg-muted">
          Chỉ hiển thị trong admin — không lộ ra storefront/customer.
        </p>
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="orderCode" value={orderCode} />
        <label htmlFor="internal-note" className="sr-only">
          Ghi chú nội bộ
        </label>
        <textarea
          id="internal-note"
          name="body"
          required
          rows={3}
          placeholder="Thêm ghi chú vận hành…"
          className="w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 py-2 text-(length:--text-sm)"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? '…' : 'Thêm ghi chú'}
        </Button>
        {!state.ok ? (
          <p className="text-(length:--text-sm) text-danger" role="alert">
            {state.message}
          </p>
        ) : state.message ? (
          <p className="text-(length:--text-sm) text-success">{state.message}</p>
        ) : null}
      </form>

      <ul className="divide-y divide-border">
        {notes.map((note) => (
          <li key={note.id} className="py-3 text-(length:--text-sm)">
            <p className="whitespace-pre-wrap text-fg">{note.body}</p>
            <p className="mt-1 text-(length:--text-xs) text-fg-subtle">
              {note.actorLabel} · {new Date(note.createdAt).toLocaleString('vi-VN')}
            </p>
          </li>
        ))}
        {notes.length === 0 ? (
          <li className="py-3 text-(length:--text-sm) text-fg-muted">Chưa có ghi chú nội bộ.</li>
        ) : null}
      </ul>
    </div>
  )
}
