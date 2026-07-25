import Link from 'next/link'

import { DataTable, type DataTableColumn } from '@/components/admin/ui/data-table'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { StatusBadge } from '@/components/admin/ui/status-badge'
import { Button } from '@/components/ui/button'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { listAdminProducts } from '@/lib/admin/queries'
import type { AdminProductListItem } from '@/lib/admin/types'

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const access = await requireAdminModule('products')
  if (isForbidden(access)) {
    return <PermissionDeniedState />
  }

  const params = await searchParams
  const status =
    params.status === 'published' || params.status === 'draft' || params.status === 'archived'
      ? params.status
      : 'all'

  const products = await listAdminProducts({ status })

  const columns: DataTableColumn<AdminProductListItem>[] = [
    {
      id: 'name',
      header: 'Tên',
      cell: (p) => (
        <div>
          <Link
            href={`/admin/products/${p.id}`}
            className="font-medium text-accent hover:underline"
          >
            {p.name}
          </Link>
          <p className="text-(length:--text-xs) text-fg-subtle">{p.slug}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (p) =>
        p.isArchived ? (
          <StatusBadge status="archived" label="archived" />
        ) : p.isPublished ? (
          <StatusBadge status="published" label="published" />
        ) : (
          <StatusBadge status="draft" label="draft" />
        ),
    },
    {
      id: 'variants',
      header: 'Biến thể',
      hideOnMobile: true,
      className: 'tabular-nums',
      cell: (p) => p.variantCount,
    },
    {
      id: 'stock',
      header: 'Tồn min',
      className: 'tabular-nums',
      cell: (p) => p.minAvailable ?? '—',
    },
    {
      id: 'category',
      header: 'Danh mục',
      hideOnMobile: true,
      cell: (p) => p.categoryName ?? '—',
    },
  ]

  return (
    <section>
      <PageHeader
        title="Sản phẩm"
        description={`${products.length} mục`}
        actions={
          <Link href="/admin/products/new">
            <Button type="button">+ Sản phẩm mới</Button>
          </Link>
        }
      />

      <DataTable
        caption="Danh sách sản phẩm"
        columns={columns}
        rows={products}
        getRowId={(p) => p.id}
        emptyTitle="Chưa có sản phẩm"
        emptyDescription="Tạo sản phẩm đầu tiên để bắt đầu quản lý catalog."
        emptyAction={
          <Link href="/admin/products/new">
            <Button type="button">+ Sản phẩm mới</Button>
          </Link>
        }
        toolbar={
          <FilterBar>
            {(
              [
                ['all', 'Tất cả'],
                ['published', 'Đã xuất bản'],
                ['draft', 'Nháp'],
                ['archived', 'Lưu trữ'],
              ] as const
            ).map(([value, label]) => (
              <FilterChip
                key={value}
                href={value === 'all' ? '/admin/products' : `/admin/products?status=${value}`}
                active={status === value}
              >
                {label}
              </FilterChip>
            ))}
          </FilterBar>
        }
      />
    </section>
  )
}
