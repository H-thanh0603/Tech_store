/**
 * Analysis delegate (port of commerce-agents analysis over a SQL view).
 * No free SQL: parameterized templates over the admin kernel only. Every
 * number comes from live systems — never invented.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

import { businessSnapshot, inventoryAlerts, orderIssues } from './backend'

export type AnalysisTemplate =
  | 'snapshot'
  | 'low_stock'
  | 'open_orders'
  | 'revenue_by_payment'
  | 'category_mix'

export const ANALYSIS_TEMPLATES: AnalysisTemplate[] = [
  'snapshot',
  'low_stock',
  'open_orders',
  'revenue_by_payment',
  'category_mix',
]

export interface AnalysisResult {
  template: AnalysisTemplate
  rows: Array<Record<string, unknown>>
  summary: string
}

/**
 * Revenue split by payment method over the last 30 days (bounded read:
 * payment_method + total only, grouped in Node).
 */
async function revenueByPayment(): Promise<AnalysisResult> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await getSupabaseAdminClient()
    .from('orders')
    .select('payment_method, total, order_status')
    .gte('created_at', since)
    .not('order_status', 'in', '(cancelled,expired)')
    .limit(1000)
  if (error) throw new Error(`revenue_by_payment: ${error.message}`)
  const groups = new Map<string, { orders: number; revenue: number }>()
  for (const row of (data ?? []) as Array<{ payment_method?: unknown; total?: unknown }>) {
    const method = String(row.payment_method ?? 'unknown')
    const entry = groups.get(method) ?? { orders: 0, revenue: 0 }
    entry.orders += 1
    entry.revenue += Number(row.total ?? 0)
    groups.set(method, entry)
  }
  const rows = [...groups.entries()].map(([payment_method, v]) => ({ payment_method, ...v }))
  const top = [...rows].sort((a, b) => b.revenue - a.revenue)[0]
  return {
    template: 'revenue_by_payment',
    rows,
    summary: top
      ? `30 ngày: ${top.orders} đơn ${top.payment_method} mang về ${top.revenue.toLocaleString('vi-VN')}₫.`
      : 'Chưa có đơn nào trong 30 ngày.',
  }
}

/** Catalog mix by category (bounded read of published products). */
async function categoryMix(): Promise<AnalysisResult> {
  const { data, error } = await getSupabaseAdminClient()
    .from('products')
    .select('category_id, is_published')
    .limit(1000)
  if (error) throw new Error(`category_mix: ${error.message}`)
  const groups = new Map<string, { total: number; published: number }>()
  for (const row of (data ?? []) as Array<{ category_id?: unknown; is_published?: unknown }>) {
    const cat = String(row.category_id ?? 'unknown')
    const entry = groups.get(cat) ?? { total: 0, published: 0 }
    entry.total += 1
    if (row.is_published) entry.published += 1
    groups.set(cat, entry)
  }
  const rows = [...groups.entries()].map(([category_id, v]) => ({ category_id, ...v }))
  return { template: 'category_mix', rows, summary: `${rows.length} nhóm danh mục trong catalog.` }
}

export async function runAnalysis(
  template: string,
  limit = 10,
): Promise<{ result: AnalysisResult | null; error?: string }> {
  if (!ANALYSIS_TEMPLATES.includes(template as AnalysisTemplate)) {
    return { result: null, error: `template phải một trong: ${ANALYSIS_TEMPLATES.join(', ')}.` }
  }
  const capped = Math.min(Math.max(Math.floor(limit) || 10, 1), 50)
  try {
    switch (template as AnalysisTemplate) {
      case 'snapshot': {
        const s = await businessSnapshot()
        return {
          result: {
            template: 'snapshot',
            rows: [{ ...s }],
            summary: `7 ngày: ${s.revenue7d.toLocaleString('vi-VN')}₫ doanh thu, ${s.newOrders7d} đơn mới, ${s.pendingOrders} đơn chờ.`,
          },
        }
      }
      case 'low_stock': {
        const alerts = await inventoryAlerts(capped)
        return {
          result: {
            template: 'low_stock',
            rows: alerts as unknown as Array<Record<string, unknown>>,
            summary: `${alerts.length} biến thể cần nhập hàng.`,
          },
        }
      }
      case 'open_orders': {
        const issues = await orderIssues(capped)
        return {
          result: {
            template: 'open_orders',
            rows: issues as unknown as Array<Record<string, unknown>>,
            summary: `${issues.length} đơn đang mở cần xử lý.`,
          },
        }
      }
      case 'revenue_by_payment':
        return { result: await revenueByPayment() }
      case 'category_mix':
        return { result: await categoryMix() }
      default:
        return { result: null, error: 'Template không hỗ trợ.' }
    }
  } catch (error) {
    return { result: null, error: error instanceof Error ? error.message : 'Phân tích thất bại.' }
  }
}
