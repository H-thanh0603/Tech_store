import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { asRecord, num } from './shared'

export async function listAdminCoupons(): Promise<import('@/lib/admin/types').AdminCouponRow[]> {
  const db = getSupabaseAdminClient()
  const { data, error } = await db
    .from('coupons')
    .select(
      'id, code, discount_type, discount_value, minimum_order, maximum_discount, starts_at, ends_at, usage_limit, is_active, created_at',
    )
    .order('created_at', { ascending: false })
  if (error) throw error

  // Active redemption counts come from one grouped RPC — never a full-table
  // pull of coupon_redemptions into Node.
  const { data: usage, error: usageError } = await db.rpc('admin_coupon_usage')
  if (usageError) throw usageError
  const usedByCoupon = asRecord(usage)
  const usedCountOf = (id: string): number => {
    const value = usedByCoupon[id]
    return typeof value === 'number' ? value : num(value)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    discountType: row.discount_type as 'percentage' | 'fixed',
    discountValue: num(row.discount_value),
    minimumOrder: num(row.minimum_order),
    maximumDiscount: row.maximum_discount == null ? null : num(row.maximum_discount),
    startsAt: row.starts_at == null ? null : String(row.starts_at),
    endsAt: row.ends_at == null ? null : String(row.ends_at),
    usageLimit: row.usage_limit == null ? null : num(row.usage_limit),
    usedCount: usedCountOf(String(row.id)),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
  }))
}

export async function getAdminCoupon(id: string) {
  const coupons = await listAdminCoupons()
  return coupons.find((c) => c.id === id) ?? null
}
