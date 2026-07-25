import { BrandManager } from '@/components/admin/brand-manager'
import { ErrorState } from '@/components/admin/ui/error-state'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { listAdminBrands } from '@/lib/admin/catalog-queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>
}) {
  const access = await requireAdminModule('brands')
  if (isForbidden(access)) return <PermissionDeniedState />

  const params = await searchParams
  const active =
    params.active === 'active' || params.active === 'inactive' ? params.active : 'all'
  const q = params.q?.trim() ?? ''

  let brands
  let error: string | null = null
  try {
    brands = await listAdminBrands({ q: q || undefined, active })
  } catch {
    error = 'Không tải được thương hiệu.'
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Thương hiệu"
        description="CRUD thương hiệu. Không xóa khi còn sản phẩm."
      />

      <form method="get" action="/admin/brands">
        <FilterBar>
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm tên hoặc slug"
            className="min-h-(--size-touch) w-full max-w-xs rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Tìm thương hiệu"
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
                ? `/admin/brands${q ? `?q=${encodeURIComponent(q)}` : ''}`
                : `/admin/brands?active=${value}${q ? `&q=${encodeURIComponent(q)}` : ''}`
            }
            active={active === value}
          >
            {label}
          </FilterChip>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : null}
      {!error && brands ? <BrandManager brands={brands} /> : null}
    </section>
  )
}
