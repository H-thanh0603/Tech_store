import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { clampRangeDays } from '@/lib/admin/dashboard-math'
import type {
  DashboardChartRange,
  DashboardKpis,
  FunnelStage,
  FunnelStageRow,
  OrdersByStatusRow,
  RecentOrderRow,
  RevenueByCategoryRow,
  RevenueDayRow,
  StockAlertRow,
  TopProductRow,
} from '@/lib/admin/types'

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const db = getSupabaseAdminClient()
  const { data, error } = await db.rpc('admin_dashboard_kpis')
  if (error) throw error
  const row = asRecord(data)
  return {
    revenueToday: num(row.revenueToday),
    revenueYesterday: num(row.revenueYesterday),
    revenueMonth: num(row.revenueMonth),
    revenuePrevMonth: num(row.revenuePrevMonth),
    ordersToday: num(row.ordersToday),
    ordersYesterday: num(row.ordersYesterday),
    pendingOrders: num(row.pendingOrders),
    aovMonth: num(row.aovMonth),
    monthOrderCount: num(row.monthOrderCount),
    lowStockCount: num(row.lowStockCount),
    outOfStockCount: num(row.outOfStockCount),
    timezone: String(row.timezone ?? 'Asia/Ho_Chi_Minh'),
  }
}

export async function getRevenueByDay(range: DashboardChartRange): Promise<RevenueDayRow[]> {
  const days = clampRangeDays(range)
  const { data, error } = await getSupabaseAdminClient().rpc('admin_revenue_by_day', {
    p_days: days,
  })
  if (error) throw error
  return asArray(data).map((item) => {
    const row = asRecord(item)
    return {
      date: String(row.date),
      revenue: num(row.revenue),
      orderCount: num(row.orderCount),
    }
  })
}

export async function getOrdersByStatus(): Promise<OrdersByStatusRow[]> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_orders_by_status')
  if (error) throw error
  return asArray(data).map((item) => {
    const row = asRecord(item)
    return {
      status: String(row.status),
      count: num(row.count),
    }
  })
}

export async function getRevenueByCategory(range: DashboardChartRange): Promise<RevenueByCategoryRow[]> {
  const days = clampRangeDays(range)
  const { data, error } = await getSupabaseAdminClient().rpc('admin_revenue_by_category', {
    p_days: days,
  })
  if (error) throw error
  return asArray(data).map((item) => {
    const row = asRecord(item)
    return {
      categoryId: String(row.categoryId),
      categoryName: String(row.categoryName),
      revenue: num(row.revenue),
      quantity: num(row.quantity),
    }
  })
}

export async function getTopProducts(
  range: DashboardChartRange,
  metric: 'revenue' | 'quantity' = 'revenue',
): Promise<TopProductRow[]> {
  const days = clampRangeDays(range)
  const { data, error } = await getSupabaseAdminClient().rpc('admin_top_products', {
    p_days: days,
    p_metric: metric,
    p_limit: 8,
  })
  if (error) throw error
  return asArray(data).map((item) => {
    const row = asRecord(item)
    return {
      productName: String(row.productName),
      sku: String(row.sku),
      quantity: num(row.quantity),
      revenue: num(row.revenue),
    }
  })
}

const FUNNEL_STAGES: FunnelStage[] = ['search', 'product', 'cart', 'checkout', 'order']

export async function getSalesFunnel(range: DashboardChartRange): Promise<FunnelStageRow[]> {
  const days = clampRangeDays(range)
  const { data, error } = await getSupabaseAdminClient().rpc('admin_sales_funnel', {
    p_days: days,
  })
  if (error) throw error

  const byStage = new Map(
    asArray(data).map((item) => {
      const row = asRecord(item)
      return [String(row.stage), num(row.count)] as const
    }),
  )
  return FUNNEL_STAGES.map((stage) => ({ stage, count: byStage.get(stage) ?? 0 }))
}

export async function getStockAlerts(): Promise<{
  lowStock: StockAlertRow[]
  outOfStock: StockAlertRow[]
}> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_stock_alerts', {
    p_limit: 10,
  })
  if (error) throw error
  const root = asRecord(data)
  const mapAlert = (item: unknown): StockAlertRow => {
    const row = asRecord(item)
    return {
      productId: String(row.productId),
      productName: String(row.productName),
      sku: String(row.sku),
      available: num(row.available),
      threshold: num(row.threshold),
      status: row.status === 'out_of_stock' ? 'out_of_stock' : 'low_stock',
    }
  }
  return {
    lowStock: asArray(root.lowStock).map(mapAlert),
    outOfStock: asArray(root.outOfStock).map(mapAlert),
  }
}

export async function getRecentOrders(limit = 8): Promise<RecentOrderRow[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from('orders')
    .select('order_code, customer_name, order_status, payment_status, total, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    orderCode: String(row.order_code),
    customerName: String(row.customer_name),
    orderStatus: String(row.order_status),
    paymentStatus: String(row.payment_status),
    total: num(row.total),
    createdAt: String(row.created_at),
  }))
}

/** Keep legacy KPI shape used by older call sites until fully migrated. */
export async function getDashboardStatsCompat() {
  const kpis = await getDashboardKpis()
  return {
    newOrders7d: kpis.ordersToday,
    pendingOrders: kpis.pendingOrders,
    lowStockCount: kpis.lowStockCount,
    draftProducts: 0,
    revenue7d: kpis.revenueMonth,
  }
}
