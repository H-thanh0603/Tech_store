import Link from 'next/link'
import { redirect } from 'next/navigation'

import { StatusBadge } from '@/components/admin/status-badge'
import { Button } from '@/components/ui/button'
import { isAdminAuthenticated } from '@/lib/admin/auth'
import { listAdminProducts } from '@/lib/admin/queries'

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const params = await searchParams
  const status =
    params.status === 'published' || params.status === 'draft' || params.status === 'archived'
      ? params.status
      : 'all'

  const products = await listAdminProducts({ status })

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-(length:--text-2xl) font-semibold">Sản phẩm</h1>
          <p className="text-(length:--text-sm) text-fg-muted">{products.length} mục</p>
        </div>
        <Link href="/admin/products/new">
          <Button type="button">+ Sản phẩm mới</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'Tất cả'],
            ['published', 'Đã xuất bản'],
            ['draft', 'Nháp'],
            ['archived', 'Lưu trữ'],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === 'all' ? '/admin/products' : `/admin/products?status=${value}`}
            className={`rounded-full px-3 py-1 text-(length:--text-sm) ${
              status === value ? 'bg-accent text-accent-fg' : 'bg-surface-muted text-fg-muted'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-(--radius-lg) border border-border">
        <table className="min-w-full text-left text-(length:--text-sm)">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Tên</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Biến thể</th>
              <th className="px-4 py-3 font-medium">Tồn min</th>
              <th className="px-4 py-3 font-medium">Danh mục</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${p.id}`} className="font-medium text-accent hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-(length:--text-xs) text-fg-subtle">{p.slug}</p>
                </td>
                <td className="px-4 py-3">
                  {p.isArchived ? (
                    <StatusBadge status="archived" label="archived" />
                  ) : p.isPublished ? (
                    <StatusBadge status="published" label="published" />
                  ) : (
                    <StatusBadge status="draft" label="draft" />
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{p.variantCount}</td>
                <td className="px-4 py-3 tabular-nums">{p.minAvailable ?? '—'}</td>
                <td className="px-4 py-3">{p.categoryName ?? '—'}</td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                  Chưa có sản phẩm.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
