'use server'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { parseAttributesJson, variantUpsertSchema } from '@/lib/admin/validation'

import { assertAdmin, fail, revalidateCatalog, salePriceValue, writeAudit } from './shared'

export async function upsertVariant(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = variantUpsertSchema.safeParse({
    variantId: formData.get('variantId') ?? '',
    sku: formData.get('sku'),
    regularPrice: formData.get('regularPrice'),
    salePrice: formData.get('salePrice') ?? '',
    isActive:
      formData.get('isActive') === 'on' ||
      formData.get('isActive') === 'true' ||
      formData.get('isActive') === '1',
    quantity: formData.get('quantity'),
    lowStockThreshold: formData.get('lowStockThreshold') ?? 5,
    attributesJson: formData.get('attributesJson') ?? '',
  })
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  }

  let attributes: Record<string, string>
  try {
    attributes = parseAttributesJson(parsed.data.attributesJson)
  } catch {
    return fail('VALIDATION_ERROR', { attributesJson: ['JSON thuộc tính không hợp lệ.'] })
  }

  const salePrice = salePriceValue(parsed.data.salePrice)
  const db = getSupabaseAdminClient()
  const variantId = parsed.data.variantId || null

  if (variantId) {
    const { data: inv } = await db
      .from('inventory')
      .select('reserved_quantity')
      .eq('variant_id', variantId)
      .maybeSingle()
    if (inv && parsed.data.quantity < Number(inv.reserved_quantity)) {
      return fail('STOCK_CONSTRAINT')
    }

    const { error: vErr } = await db
      .from('product_variants')
      .update({
        sku: parsed.data.sku,
        attributes,
        regular_price: parsed.data.regularPrice,
        sale_price: salePrice,
        is_active: parsed.data.isActive ?? true,
      })
      .eq('id', variantId)
      .eq('product_id', productId)
    if (vErr) {
      if (vErr.code === '23505') return fail('SKU_TAKEN')
      return fail('INTERNAL_ERROR')
    }

    const { error: iErr } = await db
      .from('inventory')
      .update({
        quantity: parsed.data.quantity,
        low_stock_threshold: parsed.data.lowStockThreshold,
      })
      .eq('variant_id', variantId)
    if (iErr) return fail('STOCK_CONSTRAINT')
  } else {
    const { data: variant, error: vErr } = await db
      .from('product_variants')
      .insert({
        product_id: productId,
        sku: parsed.data.sku,
        attributes,
        regular_price: parsed.data.regularPrice,
        sale_price: salePrice,
        is_active: parsed.data.isActive ?? true,
      })
      .select('id')
      .single()
    if (vErr) {
      if (vErr.code === '23505') return fail('SKU_TAKEN')
      return fail('INTERNAL_ERROR')
    }
    const { error: iErr } = await db.from('inventory').insert({
      variant_id: variant.id,
      quantity: parsed.data.quantity,
      reserved_quantity: 0,
      low_stock_threshold: parsed.data.lowStockThreshold,
    })
    if (iErr) return fail('INTERNAL_ERROR')
  }

  await writeAudit(
    parsed.data.variantId ? 'variant_update' : 'variant_create',
    parsed.data.variantId || productId,
    { sku: parsed.data.sku, regular_price: parsed.data.regularPrice, sale_price: salePrice, quantity: parsed.data.quantity },
    admin,
  )
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã lưu biến thể.' }
}
