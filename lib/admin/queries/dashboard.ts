import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { DashboardStats } from '@/lib/admin/types'
import { num } from './shared'

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getSupabaseAdminClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [orders7d, pending, drafts, lowStock] = await Promise.all([
    db.from('orders').select('total, created_at').gte('created_at', since),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('order_status', ['pending', 'awaiting_payment', 'confirmed', 'packing']),
    db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', false)
      .eq('is_archived', false),
    db.from('inventory').select('variant_id, quantity, reserved_quantity, low_stock_threshold'),
  ])

  if (orders7d.error) throw orders7d.error
  if (pending.error) throw pending.error
  if (drafts.error) throw drafts.error
  if (lowStock.error) throw lowStock.error

  const revenue7d = (orders7d.data ?? []).reduce((sum, row) => sum + num(row.total), 0)
  const lowStockCount = (lowStock.data ?? []).filter((row) => {
    const available = num(row.quantity) - num(row.reserved_quantity)
    return available <= num(row.low_stock_threshold)
  }).length

  return {
    newOrders7d: orders7d.data?.length ?? 0,
    pendingOrders: pending.count ?? 0,
    lowStockCount,
    draftProducts: drafts.count ?? 0,
    revenue7d,
  }
}
