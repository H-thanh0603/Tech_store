import Link from 'next/link'

import { InventoryAdjustPanel, InventoryTable } from '@/components/admin/inventory-manager'
import { EmptyState } from '@/components/admin/ui/empty-state'
import { ErrorState } from '@/components/admin/ui/error-state'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { AdminPagination } from '@/components/admin/ui/pagination'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import {
  listAdminInventory,
  listInventoryAdjustments,
  listStoreInventory,
} from '@/lib/admin/catalog-queries'
import { listBrands, listCategories } from '@/lib/admin/queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

function buildInventoryQuery(parts: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(parts)) {
    if (value === undefined || value === '' || value === 'all' || value === 1) continue
    if (key === 'page' && value === 1) continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await requireAdminModule('inventory')
  if (isForbidden(access)) return <PermissionDeniedState />

  const raw = await searchParams
  const get = (key: string) => {
    const v = raw[key]
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
  }

  const q = get('q').trim()
  const stock =
    get('stock') === 'in' || get('stock') === 'low' || get('stock') === 'out'
      ? get('stock')
      : 'all'
  const categoryId = get('categoryId')
  const brandId = get('brandId')
  const sort =
    get('sort') === 'available' || get('sort') === 'sku' || get('sort') === 'name'
      ? get('sort')
      : 'updated_at'
  const dir = get('dir') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(get('page') || '1', 10) || 1)
  const variantFocus = get('variant')

  const [categories, brands] = await Promise.all([listCategories(), listBrands()])

  let result
  let error: string | null = null
  try {
    result = await listAdminInventory({
      q: q || undefined,
      stock: stock as 'all' | 'in' | 'low' | 'out',
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      sort: sort as 'updated_at' | 'available' | 'sku' | 'name',
      dir,
      page,
      pageSize: 20,
    })
  } catch {
    error =
      'Không tải được tồn kho. Kiểm tra migration admin_list_inventory / inventory_adjustments.'
  }

  const focusRow = result?.rows.find((r) => r.variantId === variantFocus) ?? null
  let history = focusRow ? await listInventoryAdjustments(focusRow.variantId).catch(() => []) : []
  let stores = focusRow ? await listStoreInventory(focusRow.variantId).catch(() => []) : []

  // If focusing a variant not on current page, fetch just that list filtered by search sku later — skip for now.
  if (variantFocus && !focusRow && !error) {
    try {
      const single = await listAdminInventory({ q: variantFocus, page: 1, pageSize: 5 })
      const found = single.rows.find((r) => r.variantId === variantFocus)
      if (found) {
        history = await listInventoryAdjustments(found.variantId).catch(() => [])
        stores = await listStoreInventory(found.variantId).catch(() => [])
      }
    } catch {
      // ignore
    }
  }

  const filters = { q, stock, categoryId, brandId, sort, dir }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Tồn kho"
        description="On-hand = quantity · Reserved = reserved_quantity · Available = on-hand − reserved. Out: available ≤ 0 · Low: 0 < available ≤ threshold."
      />

      <form method="get" action="/admin/inventory" className="space-y-3">
        <FilterBar
          actions={
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-accent px-3 text-(length:--text-sm) font-semibold text-accent-fg"
            >
              Lọc
            </button>
          }
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Tên hoặc SKU"
            className="min-h-(--size-touch) w-full max-w-xs rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Tìm tồn kho"
          />
          <select
            name="categoryId"
            defaultValue={categoryId}
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
            defaultValue={brandId}
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
            name="sort"
            defaultValue={sort}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Sắp xếp"
          >
            <option value="updated_at">Cập nhật</option>
            <option value="available">Available</option>
            <option value="sku">SKU</option>
            <option value="name">Tên SP</option>
          </select>
          <select
            name="dir"
            defaultValue={dir}
            className="min-h-(--size-touch) rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Chiều"
          >
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </select>
          {stock !== 'all' ? <input type="hidden" name="stock" value={stock} /> : null}
          {variantFocus ? <input type="hidden" name="variant" value={variantFocus} /> : null}
        </FilterBar>
      </form>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'Tất cả'],
            ['in', 'Còn hàng'],
            ['low', 'Sắp hết'],
            ['out', 'Hết hàng'],
          ] as const
        ).map(([value, label]) => (
          <FilterChip
            key={value}
            href={`/admin/inventory${buildInventoryQuery({ ...filters, stock: value, page: 1 })}`}
            active={stock === value}
          >
            {label}
          </FilterChip>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : null}

      {!error && result && variantFocus ? (
        (() => {
          const row =
            result.rows.find((r) => r.variantId === variantFocus) ??
            null
          if (!row) {
            return (
              <EmptyState
                title="Không thấy biến thể trên trang này"
                description="Mở từ danh sách hoặc xóa bộ lọc."
                action={
                  <Link href="/admin/inventory" className="text-accent hover:underline">
                    Về danh sách
                  </Link>
                }
              />
            )
          }
          return (
            <div className="space-y-4">
              <Link href="/admin/inventory" className="text-(length:--text-sm) text-accent hover:underline">
                ← Danh sách tồn kho
              </Link>
              <InventoryAdjustPanel row={row} history={history} stores={stores} />
            </div>
          )
        })()
      ) : null}

      {!error && result && !variantFocus && result.rows.length === 0 ? (
        <EmptyState title="Không có dòng tồn kho" description="Thử đổi bộ lọc." />
      ) : null}

      {!error && result && !variantFocus && result.rows.length > 0 ? (
        <>
          <InventoryTable rows={result.rows} />
          <AdminPagination
            page={result.page}
            pageCount={result.pageCount}
            totalCount={result.total}
            hrefForPage={(p) =>
              `/admin/inventory${buildInventoryQuery({ ...filters, page: p })}`
            }
          />
        </>
      ) : null}
    </section>
  )
}
