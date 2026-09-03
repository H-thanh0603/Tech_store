'use server'

import { redirect } from 'next/navigation'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import { createProductSchema, productUpsertSchema } from '@/lib/admin/validation'

import { assertAdmin, fail, revalidateCatalog, salePriceValue, writeAudit } from './shared'
import { parseAttributesJson } from '@/lib/admin/validation'

export async function createProduct(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = createProductSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description') ?? '',
    categoryId: formData.get('categoryId'),
    brandId: formData.get('brandId') ?? '',
    isPublished: formData.get('isPublished') === 'on' || formData.get('isPublished') === 'true',
    isFeatured: formData.get('isFeatured') === 'on' || formData.get('isFeatured') === 'true',
    isArchived: false,
    sku: formData.get('sku'),
    regularPrice: formData.get('regularPrice'),
    salePrice: formData.get('salePrice') ?? '',
    quantity: formData.get('quantity'),
    lowStockThreshold: formData.get('lowStockThreshold') ?? 5,
    attributesJson: formData.get('attributesJson') ?? '',
    imageUrl: formData.get('imageUrl') ?? '',
    imageAlt: formData.get('imageAlt') ?? '',
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
  if (salePrice != null && salePrice > parsed.data.regularPrice) {
    return fail('VALIDATION_ERROR', { salePrice: ['Giá sale không được lớn hơn giá gốc.'] })
  }

  const db = getSupabaseAdminClient()
  const brandId = parsed.data.brandId ? parsed.data.brandId : null

  const { data: product, error: productError } = await db
    .from('products')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      category_id: parsed.data.categoryId,
      brand_id: brandId,
      is_published: false,
      is_featured: parsed.data.isFeatured,
      is_archived: false,
    })
    .select('id, slug')
    .single()

  if (productError) {
    if (productError.code === '23505') return fail('SLUG_TAKEN')
    return fail('INTERNAL_ERROR')
  }

  const { data: variant, error: variantError } = await db
    .from('product_variants')
    .insert({
      product_id: product.id,
      sku: parsed.data.sku,
      attributes,
      regular_price: parsed.data.regularPrice,
      sale_price: salePrice,
      is_active: true,
    })
    .select('id')
    .single()

  if (variantError) {
    await db.from('products').delete().eq('id', product.id)
    if (variantError.code === '23505') return fail('SKU_TAKEN')
    return fail('INTERNAL_ERROR')
  }

  const { error: invError } = await db.from('inventory').insert({
    variant_id: variant.id,
    quantity: parsed.data.quantity,
    reserved_quantity: 0,
    low_stock_threshold: parsed.data.lowStockThreshold,
  })
  if (invError) {
    await db.from('products').delete().eq('id', product.id)
    return fail('INTERNAL_ERROR')
  }

  if (parsed.data.imageUrl) {
    await db.from('product_images').insert({
      product_id: product.id,
      url: parsed.data.imageUrl,
      alt_text: parsed.data.imageAlt || null,
      sort_order: 0,
    })
  }

  if (parsed.data.isPublished) {
    const { error: pubError } = await db
      .from('products')
      .update({ is_published: true })
      .eq('id', product.id)
    if (pubError) {
      // Keep product as draft if publish trigger rejects
    }
  }

  await writeAudit(
    'product_create',
    product.id,
    { name: parsed.data.name, slug: parsed.data.slug, sku: parsed.data.sku },
    admin,
  )
  revalidateCatalog(product.id, product.slug)
  redirect(`/admin/products/${product.id}`)
}

export async function updateProduct(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = productUpsertSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description') ?? '',
    categoryId: formData.get('categoryId'),
    brandId: formData.get('brandId') ?? '',
    isPublished: formData.get('isPublished') === 'on' || formData.get('isPublished') === 'true',
    isFeatured: formData.get('isFeatured') === 'on' || formData.get('isFeatured') === 'true',
    isArchived: formData.get('isArchived') === 'on' || formData.get('isArchived') === 'true',
  })
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  }

  const db = getSupabaseAdminClient()
  const { error } = await db
    .from('products')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      category_id: parsed.data.categoryId,
      brand_id: parsed.data.brandId || null,
      is_published: parsed.data.isPublished,
      is_featured: parsed.data.isFeatured,
      is_archived: parsed.data.isArchived,
    })
    .eq('id', productId)

  if (error) {
    if (error.code === '23505') return fail('SLUG_TAKEN')
    if (error.message?.includes('active variant') || error.code === 'P0001') {
      return fail('PUBLISH_NEEDS_VARIANT')
    }
    return fail('INTERNAL_ERROR')
  }

  await writeAudit(
    'product_update',
    productId,
    {
      name: parsed.data.name,
      slug: parsed.data.slug,
      is_published: parsed.data.isPublished,
      is_featured: parsed.data.isFeatured,
      is_archived: parsed.data.isArchived,
    },
    admin,
  )
  revalidateCatalog(productId, parsed.data.slug)
  return { ok: true, message: 'Đã lưu sản phẩm.' }
}

export async function setProductArchiveState(
  productId: string,
  archived: boolean,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const db = getSupabaseAdminClient()
  const { error } = await db
    .from('products')
    .update(
      archived
        ? { is_archived: true, is_published: false }
        : { is_archived: false },
    )
    .eq('id', productId)

  if (error) return fail('INTERNAL_ERROR')

  await writeAudit('product_archive', productId, { archived }, admin)
  revalidateCatalog(productId)
  return {
    ok: true,
    message: archived ? 'Đã lưu trữ sản phẩm.' : 'Đã bỏ lưu trữ sản phẩm.',
  }
}

export async function bulkUpdateProducts(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const action = String(formData.get('bulkAction') ?? '')
  const ids = formData
    .getAll('productIds')
    .map((v) => String(v))
    .filter(Boolean)
    .slice(0, 100)

  if (ids.length === 0) {
    return fail('VALIDATION_ERROR', { productIds: ['Chọn ít nhất một sản phẩm.'] })
  }
  if (!['publish', 'draft', 'archive'].includes(action)) {
    return fail('VALIDATION_ERROR', { bulkAction: ['Hành động không hợp lệ.'] })
  }

  const db = getSupabaseAdminClient()

  if (action === 'archive') {
    const { error } = await db
      .from('products')
      .update({ is_archived: true, is_published: false })
      .in('id', ids)
    if (error) return fail('INTERNAL_ERROR')
  } else if (action === 'draft') {
    const { error } = await db
      .from('products')
      .update({ is_published: false, is_archived: false })
      .in('id', ids)
    if (error) return fail('INTERNAL_ERROR')
  } else {
    // publish only products that have at least one active variant
    const { data: withVariants, error: listError } = await db
      .from('product_variants')
      .select('product_id')
      .in('product_id', ids)
      .eq('is_active', true)
    if (listError) return fail('INTERNAL_ERROR')
    const eligible = Array.from(
      new Set((withVariants ?? []).map((row) => String(row.product_id))),
    )
    if (eligible.length === 0) return fail('PUBLISH_NEEDS_VARIANT')
    const { error } = await db
      .from('products')
      .update({ is_published: true, is_archived: false })
      .in('id', eligible)
    if (error) {
      if (error.message?.includes('active variant') || error.code === 'P0001') {
        return fail('PUBLISH_NEEDS_VARIANT')
      }
      return fail('INTERNAL_ERROR')
    }
  }

  await writeAudit('product_bulk_update', null, { action, count: ids.length }, admin)
  revalidateCatalog()
  return {
    ok: true,
    message:
      action === 'archive'
        ? `Đã lưu trữ ${ids.length} sản phẩm.`
        : action === 'draft'
          ? `Đã chuyển ${ids.length} sản phẩm sang nháp.`
          : `Đã xuất bản các sản phẩm hợp lệ.`,
  }
}
