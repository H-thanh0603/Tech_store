import Link from 'next/link'

import { EmptyState } from '@/components/admin/ui/empty-state'
import { ErrorState } from '@/components/admin/ui/error-state'
import { FilterBar } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { AdminPagination } from '@/components/admin/ui/pagination'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { listAdminCustomers } from '@/lib/admin/queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { formatPrice } from '@/lib/format'

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const access = await requireAdminModule('customers')
  if (isForbidden(access)) return <PermissionDeniedState />

  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number.parseInt(params.page || '1', 10) || 1)

  let result
  let error: string | null = null
  try {
    result = await listAdminCustomers({ q: q || undefined, page, pageSize: 20 })
  } catch {
    error = 'Không tải được khách hàng aggregate. Kiểm tra migration admin_list_customers.'
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Khách hàng"
        description="Aggregate từ orders theo số điện thoại — không phải hồ sơ tài khoản đầy đủ."
      />

      <form method="get" action="/admin/customers">
        <FilterBar>
          <input
            name="q"
            defaultValue={q}
            placeholder="Tên / SĐT / email"
            className="min-h-(--size-touch) w-full max-w-xs rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)"
            aria-label="Tìm khách"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-surface-muted px-3 text-(length:--text-sm) font-medium"
          >
            Tìm
          </button>
        </FilterBar>
      </form>

      {error ? <ErrorState message={error} /> : null}

      {!error && result && result.rows.length === 0 ? (
        <EmptyState title="Chưa có khách từ đơn hàng" />
      ) : null}

      {!error && result && result.rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-sm)">
            <table className="min-w-full text-left text-(length:--text-sm)">
              <thead className="bg-surface-muted text-fg-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Khách</th>
                  <th className="px-4 py-3 font-medium">SĐT</th>
                  <th className="px-4 py-3 font-medium">Đơn</th>
                  <th className="px-4 py-3 font-medium">Chi tiêu*</th>
                  <th className="px-4 py-3 font-medium">Đơn gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((c) => (
                  <tr key={c.key} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      {c.email ? (
                        <div className="text-(length:--text-xs) text-fg-subtle">{c.email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.phone}</td>
                    <td className="px-4 py-3 tabular-nums">{c.orderCount}</td>
                    <td className="px-4 py-3 tabular-nums">{formatPrice(c.totalSpent)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${c.lastOrderCode}`}
                        className="text-accent hover:underline"
                      >
                        {c.lastOrderCode}
                      </Link>
                      <div className="text-(length:--text-xs) text-fg-subtle">
                        {new Date(c.lastOrderAt).toLocaleString('vi-VN')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-(length:--text-xs) text-fg-muted">
            * Tổng chi tiêu loại cancelled/expired. Nguồn: {result.source}.
          </p>
          <AdminPagination
            page={result.page}
            pageCount={result.pageCount}
            totalCount={result.total}
            hrefForPage={(p) =>
              `/admin/customers?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}`
            }
          />
        </>
      ) : null}
    </section>
  )
}
