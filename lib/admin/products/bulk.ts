'use server'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'

import { assertAdmin, fail, revalidateCatalog } from './shared'

export async function bulkAdjustPrice(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const ids = formData
    .getAll('productIds')
    .map((v) => String(v))
    .filter(Boolean)
    .slice(0, 100)
  const mode = String(formData.get('bulkAction') ?? '')
  const value = Number(formData.get('bulkValue') ?? '')

  if (ids.length === 0) {
    return fail('VALIDATION_ERROR', { productIds: ['Chọn ít nhất một sản phẩm.'] })
  }
  if (!['percent_up', 'percent_down', 'set_sale_off'].includes(mode)) {
    return fail('VALIDATION_ERROR', { bulkAction: ['Chế độ chỉnh giá không hợp lệ.'] })
  }
  if (mode !== 'set_sale_off' && (!Number.isFinite(value) || value <= 0 || value > 100)) {
    return fail('VALIDATION_ERROR', { bulkValue: ['Phần trăm phải từ 1 đến 100.'] })
  }

  const { data, error } = await getSupabaseAdminClient().rpc('admin_bulk_adjust_price', {
    p_product_ids: ids,
    p_mode: mode,
    p_value: mode === 'set_sale_off' ? 0 : value,
    p_actor_label: admin.actorLabel,
  })
  if (error) return fail('INTERNAL_ERROR')

  const result = data as { code?: string; variantsUpdated?: number } | null
  if (result?.code !== 'OK') return fail('VALIDATION_ERROR')

  revalidateCatalog()
  return {
    ok: true,
    message: `Đã cập nhật giá ${result.variantsUpdated ?? 0} biến thể của ${ids.length} sản phẩm.`,
  }
}

export async function bulkSetStock(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const ids = formData
    .getAll('productIds')
    .map((v) => String(v))
    .filter(Boolean)
    .slice(0, 100)
  const quantity = Number(formData.get('bulkValue') ?? '')

  if (ids.length === 0) {
    return fail('VALIDATION_ERROR', { productIds: ['Chọn ít nhất một sản phẩm.'] })
  }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) {
    return fail('VALIDATION_ERROR', { bulkValue: ['Số lượng phải là số nguyên từ 0.'] })
  }

  const { data, error } = await getSupabaseAdminClient().rpc('admin_bulk_set_stock', {
    p_product_ids: ids,
    p_quantity: quantity,
    p_actor_label: admin.actorLabel,
  })
  if (error) return fail('INTERNAL_ERROR')

  const result = data as { code?: string; variantsUpdated?: number } | null
  if (result?.code !== 'OK') return fail('VALIDATION_ERROR')

  revalidateCatalog()
  return {
    ok: true,
    message: `Đã đặt tồn kho ${result.variantsUpdated ?? 0} biến thể của ${ids.length} sản phẩm.`,
  }
}
