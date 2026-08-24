import Link from 'next/link'

import {
  CategoryRevenueChart,
  OrdersStatusChart,
  RevenueTrendChart,
  SalesFunnel,
  TopProductsChart,
} from '@/components/admin/dashboard/charts'
import { DashboardBlock } from '@/components/admin/dashboard/dashboard-block'
import { RangeTabs } from '@/components/admin/dashboard/range-tabs'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { clampRangeDays } from '@/lib/admin/dashboard-math'
import {
  getOrdersByStatus,
  getRevenueByCategory,
  getRevenueByDay,
  getSalesFunnel,
  getTopProducts,
} from '@/lib/admin/dashboard-queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import type { DashboardChartRange } from '@/lib/admin/types'

// Reports dashboard: revenue trend, orders by status, category revenue, top
// products. Reuses the admin dashboard queries + chart components; KPI/ops
// blocks stay on /admin.
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; metric?: string }>
}) {
  const access = await requireAdminModule('reports')
  if (isForbidden(access)) return <PermissionDeniedState />

  const params = await searchParams
  const range = clampRangeDays(Number(params.range ?? 30)) as DashboardChartRange
  const metric = params.metric === 'quantity' ? 'quantity' : 'revenue'

  const [funnel, revenueTrend, ordersStatus, categoryRevenue, topProducts] = await Promise.all([
    safe(getSalesFunnel(range)),
    safe(getRevenueByDay(range)),
    safe(getOrdersByStatus()),
    safe(getRevenueByCategory(range)),
    safe(getTopProducts(range, metric)),
  ])

  return (
    <section className="space-y-6">
      <PageHeader
        title="Báo cáo"
        description={`Doanh thu ${range} ngày gần nhất · loại đơn cancelled/expired. Audit log ở tab riêng.`}
        actions={<RangeTabs range={range} metric={metric} basePath="/admin/reports" />}
      />

      <DashboardBlock
        title="Phễu bán hàng"
        description={`${range} ngày · phiên đi tuần tự search → product → cart → checkout → order`}
        error={funnel.error}
        empty={!funnel.error && (funnel.data?.[0]?.count ?? 0) === 0}
        emptyDescription="Chưa có phiên tìm kiếm nào trong khoảng thời gian này."
      >
        {funnel.data ? <SalesFunnel data={funnel.data} /> : null}
      </DashboardBlock>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardBlock
          title="Doanh thu theo ngày"
          description={`${range} ngày gần nhất`}
          error={revenueTrend.error}
          empty={!revenueTrend.error && (revenueTrend.data?.length ?? 0) === 0}
          emptyDescription="Chưa có đơn hợp lệ trong khoảng thời gian này."
        >
          {revenueTrend.data ? <RevenueTrendChart data={revenueTrend.data} /> : null}
        </DashboardBlock>

        <DashboardBlock
          title="Đơn theo trạng thái"
          description="Toàn bộ đơn hiện có"
          error={ordersStatus.error}
          empty={!ordersStatus.error && (ordersStatus.data?.length ?? 0) === 0}
        >
          {ordersStatus.data ? <OrdersStatusChart data={ordersStatus.data} /> : null}
        </DashboardBlock>

        <DashboardBlock
          title="Doanh thu theo danh mục"
          description={`${range} ngày · từ order item + category hiện tại`}
          error={categoryRevenue.error}
          empty={!categoryRevenue.error && (categoryRevenue.data?.length ?? 0) === 0}
        >
          {categoryRevenue.data ? <CategoryRevenueChart data={categoryRevenue.data} /> : null}
        </DashboardBlock>

        <DashboardBlock
          title="Sản phẩm bán chạy"
          description={`${range} ngày`}
          actions={
            <div className="flex gap-1">
              <Link
                href={`/admin/reports?range=${range}&metric=revenue`}
                className={`rounded-full px-3 py-1 text-(length:--text-sm) ${
                  metric === 'revenue' ? 'bg-accent text-accent-fg' : 'bg-surface-muted text-fg-muted'
                }`}
              >
                Doanh thu
              </Link>
              <Link
                href={`/admin/reports?range=${range}&metric=quantity`}
                className={`rounded-full px-3 py-1 text-(length:--text-sm) ${
                  metric === 'quantity' ? 'bg-accent text-accent-fg' : 'bg-surface-muted text-fg-muted'
                }`}
              >
                Số lượng
              </Link>
            </div>
          }
          error={topProducts.error}
          empty={!topProducts.error && (topProducts.data?.length ?? 0) === 0}
        >
          {topProducts.data ? <TopProductsChart data={topProducts.data} metric={metric} /> : null}
        </DashboardBlock>
      </div>

      <DashboardBlock title="Audit log" description="Lịch sử thao tác quản trị.">
        <Link
          href="/admin/reports/audit"
          className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold text-fg hover:border-brand/50"
        >
          Mở audit log
        </Link>
      </DashboardBlock>
    </section>
  )
}

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await promise, error: null }
  } catch {
    return { data: null, error: 'Không tải được khối dữ liệu này.' }
  }
}
