'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog'
import { FormSection } from '@/components/admin/ui/form-section'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { useToast } from '@/components/admin/ui/toast-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteBrand, setBrandActive, upsertBrand } from '@/lib/admin/catalog-actions'
import type { AdminActionState, AdminBrandRow } from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }

export function BrandManager({ brands }: { brands: AdminBrandRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState<AdminBrandRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<AdminBrandRow | null>(null)
  const [state, action, formPending] = useActionState(
    async (prev: AdminActionState, formData: FormData) => {
      const result = await upsertBrand(prev, formData)
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
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Thương hiệu</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">SP</th>
              <th className="px-4 py-3 font-medium">TT</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Hành động</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logoUrl}
                        alt=""
                        className="h-9 w-9 rounded border border-border object-contain"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-surface-muted text-(length:--text-xs) text-fg-subtle">
                        —
                      </div>
                    )}
                    <span className="font-medium">{b.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-fg-muted">{b.slug}</td>
                <td className="px-4 py-3 tabular-nums">{b.productCount}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={b.isActive ? 'active' : 'inactive'}
                    label={b.isActive ? 'active' : 'inactive'}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="min-h-10 rounded px-2 text-accent hover:bg-accent-subtle"
                      onClick={() => setEditing(b)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="min-h-10 rounded px-2 text-fg-muted hover:bg-surface-muted"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await setBrandActive(b.id, !b.isActive)
                          toast({
                            title: result.ok ? 'Thành công' : 'Thất bại',
                            description: result.message,
                            tone: result.ok ? 'success' : 'error',
                          })
                          router.refresh()
                        })
                      }
                    >
                      {b.isActive ? 'Tắt' : 'Bật'}
                    </button>
                    <button
                      type="button"
                      className="min-h-10 rounded px-2 text-danger hover:bg-danger-subtle"
                      onClick={() => setConfirmDelete(b)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {brands.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                  Chưa có thương hiệu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <FormSection
        title={editing ? 'Sửa thương hiệu' : 'Tạo thương hiệu'}
        description="Logo là URL công khai (Storage upload sẽ bổ sung sau)."
      >
        <form action={action} className="space-y-3" key={editing?.id ?? 'new'}>
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Input
            id="brand-name"
            name="name"
            label="Tên"
            required
            defaultValue={editing?.name ?? ''}
            error={fieldError('name')}
          />
          <Input
            id="brand-slug"
            name="slug"
            label="Slug"
            required
            defaultValue={editing?.slug ?? ''}
            error={fieldError('slug')}
          />
          <Input
            id="brand-logo"
            name="logoUrl"
            label="Logo URL"
            defaultValue={editing?.logoUrl ?? ''}
            error={fieldError('logoUrl')}
          />
          <label className="inline-flex items-center gap-2 text-(length:--text-sm)">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={editing?.isActive ?? true}
              className="size-4"
            />
            Đang hoạt động
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

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Xóa thương hiệu?"
        description={
          confirmDelete
            ? `${confirmDelete.name} — chỉ xóa được nếu không còn sản phẩm gắn kèm.`
            : undefined
        }
        tone="danger"
        confirmLabel="Xóa"
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return
          startTransition(async () => {
            const result = await deleteBrand(confirmDelete.id)
            toast({
              title: result.ok ? 'Thành công' : 'Thất bại',
              description: result.message,
              tone: result.ok ? 'success' : 'error',
            })
            setConfirmDelete(null)
            router.refresh()
          })
        }}
      />
    </div>
  )
}
