/**
 * Scheduled digest (port of commerce-agents digest flow). A daily cron
 * composes snapshot + alerts + open orders into merchant_digests; the
 * merchant assistant reads the latest row as morning context.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

import { runAnalysis } from './analysis'

export interface MerchantDigest {
  id: string
  period: string
  payload: {
    snapshot?: unknown
    low_stock?: unknown
    open_orders?: unknown
  }
  created_at: string
}

export async function composeDigest(): Promise<{ ok: boolean; id?: string; error?: string }> {
  const [snapshot, lowStock, openOrders] = await Promise.all([
    runAnalysis('snapshot'),
    runAnalysis('low_stock', 10),
    runAnalysis('open_orders', 10),
  ])
  if (!snapshot.result || !lowStock.result || !openOrders.result) {
    return { ok: false, error: 'Không đọc được số liệu live.' }
  }
  const payload = {
    snapshot: snapshot.result.rows[0] ?? null,
    low_stock: lowStock.result.rows,
    open_orders: openOrders.result.rows,
  }
  const { data, error } = await getSupabaseAdminClient()
    .from('merchant_digests')
    .insert({ period: 'daily', payload })
    .select('id')
    .single()
  if (error || !data || typeof data !== 'object') return { ok: false, error: 'Không lưu được digest.' }
  return { ok: true, id: String((data as { id: unknown }).id ?? '') }
}

export async function latestDigest(): Promise<MerchantDigest | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('merchant_digests')
    .select('id, period, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  return {
    id: String(row.id ?? ''),
    period: String(row.period ?? ''),
    payload: (row.payload ?? {}) as MerchantDigest['payload'],
    created_at: String(row.created_at ?? ''),
  }
}
