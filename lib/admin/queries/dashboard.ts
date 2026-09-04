import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { DashboardStats } from '@/lib/admin/types'
import { num } from './shared'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * 7-day dashboard aggregates via the admin_dashboard_stats_7d RPC — one round
 * trip, no row ceiling. (The previous implementation pulled the full inventory
 * table into Node and silently under-counted past PostgREST's 1000-row cap.)
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_dashboard_stats_7d')
  if (error) throw error

  const root = asRecord(data)
  return {
    newOrders7d: num(root.newOrders7d),
    pendingOrders: num(root.pendingOrders),
    lowStockCount: num(root.lowStockCount),
    draftProducts: num(root.draftProducts),
    revenue7d: num(root.revenue7d),
  }
}
