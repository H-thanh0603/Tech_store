import { CategoryManager } from '@/components/admin/category-manager'
import { ErrorState } from '@/components/admin/ui/error-state'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { listAdminCategories } from '@/lib/admin/catalog-queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>
}) {
  const access = await requireAdminModule('categories')
  if (isForbidden(access)) return <PermissionDeniedState />

  const params = await searchParams
  const active =
    params.active === 'active' || params.active === 'inactive' ? params.active : 'all'
  const q = params.q?.trim() ?? ''

  let categories
  let error: string | null = null
  try {
    categories = await listAdminCategories({ q: q || undefined, active })
  } catch {
    error = 'Không tải được danh mục.'
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Danh mục"
        description="CRUD danh mục. Không xóa khi còn sản phẩm."
      />

      <form method="get" action="/admin/categories">
        <FilterBar>
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm tên hoặc slug"
            className="min-h-(--size-touch) w-full max-w-xs rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Tìm danh mục"
          />
          {active !== 'all' ? <input type="hidden" name="active" value={active} /> : null}
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-surface-muted px-3 text-(length:--text-sm) font-medium"
          >
            Tìm
          </button>
        </FilterBar>
      </form>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'Tất cả'],
            ['active', 'Active'],
            ['inactive', 'Inactive'],
          ] as const
        ).map(([value, label]) => (
          <FilterChip
            key={value}
            href={
              value === 'all'
                ? `/admin/categories${q ? `?q=${encodeURIComponent(q)}` : ''}`
                : `/admin/categories?active=${value}${q ? `&q=${encodeURIComponent(q)}` : ''}`
            }
            active={active === value}
          >
            {label}
          </FilterChip>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : null}
      {!error && categories ? <CategoryManager categories={categories} /> : null}
    </section>
  )
}
