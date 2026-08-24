import { getExistingCartTokenHash } from '@/lib/commerce/cookies'
import type { PickupStore, ProductPickupStore } from '@/lib/commerce/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function mapStore(row: Record<string, unknown>): PickupStore {
  return {
    id: String(row.id ?? row.storeId),
    name: String(row.name ?? row.storeName),
    phone: row.phone == null ? null : String(row.phone),
    province: String(row.province),
    district: String(row.district),
    address: String(row.address),
    openingHours: String(row.openingHours),
  }
}

export async function getPickupStoresForCart(): Promise<PickupStore[]> {
  const tokenHash = await getExistingCartTokenHash()
  if (!tokenHash) return []
  const { data, error } = await getSupabaseServerClient().rpc('pickup_stores_for_cart', {
    p_cart_token_hash: tokenHash,
  })
  if (error) throw new Error('Failed to load pickup stores')
  return (Array.isArray(data) ? data : []).map((item) => mapStore(asRecord(item)))
}

export async function getProductPickupStores(productId: string): Promise<ProductPickupStore[]> {
  const { data, error } = await getSupabaseServerClient().rpc('product_pickup_availability', {
    p_product_id: productId,
  })
  if (error) throw new Error('Failed to load product pickup availability')

  const stores = new Map<string, ProductPickupStore>()
  for (const item of Array.isArray(data) ? data : []) {
    const row = asRecord(item)
    const store = mapStore(row)
    const existing = stores.get(store.id) ?? { ...store, variants: [] }
    existing.variants.push({ variantId: String(row.variantId), available: num(row.available) })
    stores.set(store.id, existing)
  }
  return [...stores.values()]
}
