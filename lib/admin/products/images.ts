'use server'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { imageDeleteSchema, imageUpsertSchema } from '@/lib/admin/validation'

import { assertAdmin, fail, revalidateCatalog, writeAudit } from './shared'

export async function upsertImage(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = imageUpsertSchema.safeParse({
    imageId: formData.get('imageId') ?? '',
    url: formData.get('url'),
    altText: formData.get('altText') ?? '',
    sortOrder: formData.get('sortOrder') ?? 0,
    variantId: formData.get('variantId') ?? '',
  })
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  }

  const db = getSupabaseAdminClient()
  const payload = {
    product_id: productId,
    url: parsed.data.url,
    alt_text: parsed.data.altText || null,
    sort_order: parsed.data.sortOrder,
    variant_id: parsed.data.variantId || null,
  }

  if (parsed.data.imageId) {
    const { error } = await db.from('product_images').update(payload).eq('id', parsed.data.imageId)
    if (error) return fail('INTERNAL_ERROR')
  } else {
    const { error } = await db.from('product_images').insert(payload)
    if (error) return fail('INTERNAL_ERROR')
  }

  revalidateCatalog(productId)
  return { ok: true, message: 'Đã lưu ảnh.' }
}

export async function deleteImage(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = imageDeleteSchema.safeParse({ imageId: formData.get('imageId') })
  if (!parsed.success) return fail('VALIDATION_ERROR')

  const { error } = await getSupabaseAdminClient()
    .from('product_images')
    .delete()
    .eq('id', parsed.data.imageId)
    .eq('product_id', productId)
  if (error) return fail('INTERNAL_ERROR')

  await writeAudit('image_delete', productId, { image_id: parsed.data.imageId }, admin)
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã xóa ảnh.' }
}
