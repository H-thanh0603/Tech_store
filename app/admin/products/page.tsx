import Link from 'next/link'

import { ProductListTable } from '@/components/admin/product-list-client'
import { EmptyState } from '@/components/admin/ui/empty-state'
import { ErrorState } from '@/components/admin/ui/error-state'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { AdminPagination } from '@/components/admin/ui/pagination'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { Button } from '@/components/ui/button'
import {
  buildProductListQuery,
  parseProductListParams,
} from '@/lib/admin/product-search-params'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { listAdminProducts, listBrands, listCategories } from '@/lib/admin/queries'

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await requireAdminModule('products')
  if (isForbidden(access)) {
    return <PermissionDeniedState />
  }

  const params = await searchParams
  const filters = parseProductListParams(params)

  const [categories, brands] = await Promise.all([listCategories(), listBrands()])

  let result
  let error: string | null = null
  try {
    result = await listAdminProducts({
      q: filters.q || undefined,
      status: filters.status,
      categoryId: filters.categoryId || undefined,
      brandId: filters.brandId || undefined,
      stock: filters.stock,
      sort: filters.sort,
      dir: filters.dir,
      page: filters.page,
      pageSize: filters.pageSize,
    })
  } catch {
    error =
      'Không tải được danh sách sản phẩm. Kiểm tra migration admin_list_products và service role.'
  }

  const baseFilters = { ...filters }

  return (
    <section>
      <PageHeader
        title="Sản phẩm"
        description={
          result
            ? `${result.total} sản phẩm · trang ${result.page}/${result.pageCount}`
            : 'Quản lý catalog'
        }
        actions={
          <Link href="/admin/products/new">
            <Button type="button">+ Sản phẩm mới</Button>
          </Link>
        }
      />

      <form className="mb-4 space-y-3" method="get" action="/admin/products">
        <FilterBar
          actions={
            <>
              <Button type="submit" variant="secondary">
                Lọc
              </Button>
              <Link
                href="/admin/products"
                className="inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:text-fg"
              >
                Reset
              </Link>
            </>
          }
        >
          <label className="sr-only" htmlFor="product-q">
            Tìm kiếm
          </label>
          <input
            id="product-q"
            name="q"
            defaultValue={filters.q}
            placeholder="Tên, slug hoặc SKU"
            className="min-h-(--size-touch) w-full max-w-xs rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
          />
          <select
            name="categoryId"
            defaultValue={filters.categoryId}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Danh mục"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="brandId"
            defaultValue={filters.brandId}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Thương hiệu"
          >
            <option value="">Tất cả thương hiệu</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            name="stock"
            defaultValue={filters.stock}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Tồn kho"
          >
            <option value="all">Mọi tồn kho</option>
            <option value="in">Còn hàng</option>
            <option value="low">Sắp hết</option>
            <option value="out">Hết hàng</option>
          </select>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Sắp xếp"
          >
            <option value="updated_at">Cập nhật</option>
            <option value="name">Tên</option>
            <option value="price">Giá</option>
            <option value="stock">Tồn kho</option>
          </select>
          <select
            name="dir"
            defaultValue={filters.dir}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Chiều sắp xếp"
          >
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </select>
          {filters.status !== 'all' ? (
            <input type="hidden" name="status" value={filters.status} />
          ) : null}
        </FilterBar>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
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
            href={`/admin/products${buildProductListQuery({ ...baseFilters, status: value, page: 1 })}`}
            active={filters.status === value}
          >
            {label}
          </FilterChip>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : null}

      {!error && result && result.rows.length === 0 ? (
        <EmptyState
          title="Không có sản phẩm"
          description="Thử đổi bộ lọc hoặc tạo sản phẩm mới."
          action={
            <Link href="/admin/products/new">
              <Button type="button">+ Sản phẩm mới</Button>
            </Link>
          }
        />
      ) : null}

      {!error && result && result.rows.length > 0 ? (
        <>
          <ProductListTable products={result.rows} />
          <div className="mt-4">
            <AdminPagination
              page={result.page}
              pageCount={result.pageCount}
              totalCount={result.total}
              hrefForPage={(page) =>
                `/admin/products${buildProductListQuery({ ...baseFilters, page })}`
              }
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
