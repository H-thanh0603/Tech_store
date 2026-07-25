'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog'
import { FormField } from '@/components/admin/ui/form-field'
import { FormSection } from '@/components/admin/ui/form-section'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { useToast } from '@/components/admin/ui/toast-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteCategory,
  setCategoryActive,
  upsertCategory,
} from '@/lib/admin/catalog-actions'
import type { AdminActionState, AdminCategoryRow } from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }

export function CategoryManager({ categories }: { categories: AdminCategoryRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState<AdminCategoryRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<AdminCategoryRow | null>(null)
  const [state, action, formPending] = useActionState(
    async (prev: AdminActionState, formData: FormData) => {
      const result = await upsertCategory(prev, formData)
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
              <th className="px-4 py-3 font-medium">Tên</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Cha</th>
              <th className="px-4 py-3 font-medium">SP</th>
              <th className="px-4 py-3 font-medium">TT</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Hành động</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-fg-muted">{c.slug}</td>
                <td className="hidden px-4 py-3 md:table-cell">{c.parentName ?? '—'}</td>
                <td className="px-4 py-3 tabular-nums">{c.productCount}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={c.isActive ? 'active' : 'inactive'}
                    label={c.isActive ? 'active' : 'inactive'}
                  />
                </td>
                <td className="px-4 py-3">
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
                          const result = await setCategoryActive(c.id, !c.isActive)
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
                    <button
                      type="button"
                      className="min-h-10 rounded px-2 text-danger hover:bg-danger-subtle"
                      onClick={() => setConfirmDelete(c)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-fg-muted">
                  Chưa có danh mục.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <FormSection
        title={editing ? 'Sửa danh mục' : 'Tạo danh mục'}
        description="Slug duy nhất. Không xóa khi còn sản phẩm."
      >
        <form action={action} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Input
            id="category-name"
            name="name"
            label="Tên"
            required
            defaultValue={editing?.name ?? ''}
            error={fieldError('name')}
          />
          <Input
            id="category-slug"
            name="slug"
            label="Slug"
            required
            defaultValue={editing?.slug ?? ''}
            error={fieldError('slug')}
          />
          <FormField id="category-parent" label="Danh mục cha">
            <select
              id="category-parent"
              name="parentId"
              defaultValue={editing?.parentId ?? ''}
              className="min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            >
              <option value="">— Không —</option>
              {categories
                .filter((c) => c.id !== editing?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </FormField>
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
        title="Xóa danh mục?"
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
            const result = await deleteCategory(confirmDelete.id)
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
