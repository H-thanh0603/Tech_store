import Link from 'next/link'

import {
  CategoryRevenueChart,
  OrdersStatusChart,
  RevenueTrendChart,
  TopProductsChart,
} from '@/components/admin/dashboard/charts'
import { DashboardBlock } from '@/components/admin/dashboard/dashboard-block'
import { KpiCard } from '@/components/admin/dashboard/kpi-card'
import { RecentOrdersList, StockAlertList } from '@/components/admin/dashboard/ops-lists'
import { RangeTabs } from '@/components/admin/dashboard/range-tabs'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { ErrorState } from '@/components/admin/ui/error-state'
import {
  getDashboardKpis,
  getOrdersByStatus,
  getRecentOrders,
  getRevenueByCategory,
  getRevenueByDay,
  getStockAlerts,
  getTopProducts,
} from '@/lib/admin/dashboard-queries'
import { clampRangeDays } from '@/lib/admin/dashboard-math'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import type { DashboardChartRange } from '@/lib/admin/types'
import { formatPrice } from '@/lib/format'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; metric?: string }>
}) {
  const access = await requireAdminModule('dashboard')
  if (isForbidden(access)) {
    return <PermissionDeniedState />
  }

  const params = await searchParams
  const range = clampRangeDays(Number(params.range ?? 30)) as DashboardChartRange
  const metric = params.metric === 'quantity' ? 'quantity' : 'revenue'

  let kpisError: string | null = null
  let kpis = null as Awaited<ReturnType<typeof getDashboardKpis>> | null
  try {
    kpis = await getDashboardKpis()
  } catch {
    kpisError =
      'Không đọc được KPI. Kiểm tra migration admin_dashboard và SUPABASE_SERVICE_ROLE_KEY.'
  }

  const [revenueTrend, ordersStatus, categoryRevenue, topProducts, stock, recent] =
    await Promise.all([
      safe(getRevenueByDay(range)),
      safe(getOrdersByStatus()),
      safe(getRevenueByCategory(range)),
      safe(getTopProducts(range, metric)),
      safe(getStockAlerts()),
      safe(getRecentOrders(8)),
    ])

  return (
    <section className="space-y-6">
      <PageHeader
        title="Tổng quan"
        description={`Trung tâm điều hành · múi giờ ${kpis?.timezone ?? 'Asia/Ho_Chi_Minh'}. Doanh thu chỉ tính đơn không cancelled/expired.`}
        actions={<RangeTabs range={range} metric={metric} />}
      />

      {kpisError ? <ErrorState message={kpisError} /> : null}

      {kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Doanh thu hôm nay"
            value={formatPrice(kpis.revenueToday)}
            definition="Tổng total các đơn tạo trong ngày (Asia/Ho_Chi_Minh), loại cancelled/expired."
            currentNumeric={kpis.revenueToday}
            previousValue={kpis.revenueYesterday}
            previousLabel="hôm qua"
            href="/admin/orders"
          />
          <KpiCard
            label="Doanh thu tháng này"
            value={formatPrice(kpis.revenueMonth)}
            definition="Tổng total từ đầu tháng đến nay theo múi giờ cửa hàng, loại cancelled/expired."
            currentNumeric={kpis.revenueMonth}
            previousValue={kpis.revenuePrevMonth}
            previousLabel="tháng trước"
            href="/admin/orders"
          />
          <KpiCard
            label="Đơn hôm nay"
            value={String(kpis.ordersToday)}
            definition="Số đơn tạo trong ngày (không tính cancelled/expired)."
            currentNumeric={kpis.ordersToday}
            previousValue={kpis.ordersYesterday}
            previousLabel="hôm qua"
            href="/admin/orders"
          />
          <KpiCard
            label="Đơn chờ xử lý"
            value={String(kpis.pendingOrders)}
            definition="pending, awaiting_payment, confirmed, packing."
            href="/admin/orders"
          />
          <KpiCard
            label="AOV tháng"
            value={formatPrice(kpis.aovMonth)}
            definition="Doanh thu tháng ÷ số đơn hợp lệ trong tháng. 0 khi chưa có đơn."
            href="/admin/orders"
          />
          <KpiCard
            label="Sắp hết hàng"
            value={String(kpis.lowStockCount)}
            definition="available > 0 và available ≤ low_stock_threshold."
            href="/admin/inventory"
          />
          <KpiCard
            label="Hết hàng"
            value={String(kpis.outOfStockCount)}
            definition="available ≤ 0 (quantity − reserved)."
            href="/admin/inventory"
          />
        </div>
      ) : null}

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
                href={`/admin?range=${range}&metric=revenue`}
                className={`rounded-full px-3 py-1 text-(length:--text-sm) ${
                  metric === 'revenue' ? 'bg-accent text-accent-fg' : 'bg-surface-muted text-fg-muted'
                }`}
              >
                Doanh thu
              </Link>
              <Link
                href={`/admin?range=${range}&metric=quantity`}
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

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardBlock
          title="Đơn gần đây"
          error={recent.error}
          empty={!recent.error && (recent.data?.length ?? 0) === 0}
          emptyDescription="Chưa có đơn hàng."
        >
          {recent.data ? <RecentOrdersList orders={recent.data} /> : null}
        </DashboardBlock>

        <DashboardBlock
          title="Sắp hết hàng"
          error={stock.error}
          empty={!stock.error && (stock.data?.lowStock.length ?? 0) === 0}
          emptyDescription="Không có SKU sắp hết."
        >
          {stock.data ? <StockAlertList items={stock.data.lowStock} /> : null}
        </DashboardBlock>

        <DashboardBlock
          title="Hết hàng"
          error={stock.error}
          empty={!stock.error && (stock.data?.outOfStock.length ?? 0) === 0}
          emptyDescription="Không có SKU hết hàng."
        >
          {stock.data ? <StockAlertList items={stock.data.outOfStock} /> : null}
        </DashboardBlock>
      </div>

      {(kpis?.pendingOrders ?? 0) > 0 ||
      (kpis?.lowStockCount ?? 0) > 0 ||
      (kpis?.outOfStockCount ?? 0) > 0 ? (
        <DashboardBlock title="Cảnh báo cần xử lý" description="Tóm tắt nhanh từ KPI hiện tại.">
          <ul className="list-disc space-y-1 pl-5 text-(length:--text-sm) text-fg">
            {(kpis?.pendingOrders ?? 0) > 0 ? (
              <li>
                <Link href="/admin/orders" className="text-accent hover:underline">
                  {kpis?.pendingOrders} đơn đang chờ xử lý
                </Link>
              </li>
            ) : null}
            {(kpis?.lowStockCount ?? 0) > 0 ? (
              <li>
                <Link href="/admin/inventory" className="text-accent hover:underline">
                  {kpis?.lowStockCount} SKU sắp hết hàng
                </Link>
              </li>
            ) : null}
            {(kpis?.outOfStockCount ?? 0) > 0 ? (
              <li>
                <Link href="/admin/inventory" className="text-accent hover:underline">
                  {kpis?.outOfStockCount} SKU hết hàng
                </Link>
              </li>
            ) : null}
          </ul>
        </DashboardBlock>
      ) : null}
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
