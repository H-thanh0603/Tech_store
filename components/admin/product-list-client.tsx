'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { Button } from '@/components/ui/button'
import { bulkUpdateProducts, setProductArchiveState } from '@/lib/admin/product-actions'
import { formatPrice } from '@/lib/format'
import type { AdminProductListItem } from '@/lib/admin/types'
import { useToast } from '@/components/admin/ui/toast-provider'

export function ProductListTable({ products }: { products: AdminProductListItem[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<null | {
    title: string
    description: string
    action: () => Promise<void>
  }>(null)

  const allIds = useMemo(() => products.map((p) => p.id), [products])
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  function toggleAll() {
    setSelected(() => {
      if (allSelected) return new Set()
      return new Set(allIds)
    })
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runBulk(bulkAction: 'publish' | 'draft' | 'archive') {
    const ids = Array.from(selected)
    if (ids.length === 0) return

    const labels = {
      publish: 'Xuất bản',
      draft: 'Chuyển nháp',
      archive: 'Lưu trữ',
    } as const

    setConfirm({
      title: `${labels[bulkAction]} ${ids.length} sản phẩm?`,
      description:
        bulkAction === 'archive'
          ? 'Sản phẩm sẽ ẩn khỏi storefront và không còn published.'
          : bulkAction === 'publish'
            ? 'Chỉ sản phẩm có biến thể active mới được xuất bản.'
            : 'Các sản phẩm sẽ về trạng thái nháp (chưa xuất bản).',
      action: async () => {
        const form = new FormData()
        form.set('bulkAction', bulkAction)
        for (const id of ids) form.append('productIds', id)
        const result = await bulkUpdateProducts({ ok: true }, form)
        if (!result.ok) {
          toast({ title: 'Thất bại', description: result.message, tone: 'error' })
        } else {
          toast({ title: 'Thành công', description: result.message, tone: 'success' })
          setSelected(new Set())
          router.refresh()
        }
      },
    })
  }

  function archiveOne(product: AdminProductListItem) {
    setConfirm({
      title: product.isArchived ? 'Bỏ lưu trữ sản phẩm?' : 'Lưu trữ sản phẩm?',
      description: product.isArchived
        ? `${product.name} sẽ hiện lại trong danh sách active.`
        : `${product.name} sẽ ẩn khỏi storefront. Không hard-delete.`,
      action: async () => {
        const result = await setProductArchiveState(product.id, !product.isArchived)
        if (!result.ok) {
          toast({ title: 'Thất bại', description: result.message, tone: 'error' })
        } else {
          toast({ title: 'Thành công', description: result.message, tone: 'success' })
          router.refresh()
        }
      },
    })
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-(--radius-md) border border-accent/30 bg-accent-subtle px-3 py-2">
          <span className="text-(length:--text-sm) font-medium text-accent">
            {selected.size} đã chọn
          </span>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => runBulk('publish')}>
            Xuất bản
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => runBulk('draft')}>
            Nháp
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => runBulk('archive')}>
            Lưu trữ
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <caption className="sr-only">Danh sách sản phẩm</caption>
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả trên trang"
                  className="size-4"
                />
              </th>
              <th className="px-3 py-3 font-medium">Sản phẩm</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">Danh mục</th>
              <th className="hidden px-3 py-3 font-medium lg:table-cell">Thương hiệu</th>
              <th className="px-3 py-3 font-medium">Giá</th>
              <th className="px-3 py-3 font-medium">Tồn</th>
              <th className="px-3 py-3 font-medium">Trạng thái</th>
              <th className="px-3 py-3 font-medium">
                <span className="sr-only">Hành động</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const priceLabel =
                p.minPrice != null && p.maxPrice != null
                  ? p.minPrice === p.maxPrice
                    ? formatPrice(p.minPrice)
                    : `${formatPrice(p.minPrice)} – ${formatPrice(p.maxPrice)}`
                  : '—'
              return (
                <tr key={p.id} className="border-t border-border hover:bg-surface-muted/40">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      aria-label={`Chọn ${p.name}`}
                      className="size-4"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-11 w-11 rounded-(--radius-md) border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-(--radius-md) bg-surface-muted text-(length:--text-xs) text-fg-subtle">
                          N/A
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="font-medium text-accent hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="truncate text-(length:--text-xs) text-fg-subtle">
                          {p.slug} · {p.variantCount} biến thể
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 md:table-cell">{p.categoryName ?? '—'}</td>
                  <td className="hidden px-3 py-3 lg:table-cell">{p.brandName ?? '—'}</td>
                  <td className="px-3 py-3 tabular-nums">{priceLabel}</td>
                  <td className="px-3 py-3 tabular-nums">{p.totalAvailable ?? p.minAvailable ?? '—'}</td>
                  <td className="px-3 py-3">
                    {p.isArchived ? (
                      <StatusBadge status="archived" label="archived" />
                    ) : p.isPublished ? (
                      <StatusBadge status="published" label="published" />
                    ) : (
                      <StatusBadge status="draft" label="draft" />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="inline-flex min-h-10 items-center rounded-(--radius-md) px-2 text-(length:--text-sm) font-medium text-accent hover:bg-accent-subtle"
                      >
                        Sửa
                      </Link>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center rounded-(--radius-md) px-2 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
                        onClick={() => archiveOne(p)}
                      >
                        {p.isArchived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        tone="danger"
        loading={pending}
        confirmLabel="Xác nhận"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return
          startTransition(async () => {
            await confirm.action()
            setConfirm(null)
          })
        }}
      />
    </div>
  )
}
