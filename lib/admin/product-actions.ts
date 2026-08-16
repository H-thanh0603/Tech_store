'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminSession, type AdminSession } from '@/lib/admin/auth'
import { adminUserMessage } from '@/lib/admin/errors'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'
import {
  createProductSchema,
  imageDeleteSchema,
  imageUpsertSchema,
  parseAttributesJson,
  productUpsertSchema,
  specDeleteSchema,
  specUpsertSchema,
  useCasesSchema,
  variantUpsertSchema,
} from '@/lib/admin/validation'

function fail(
  code: string,
  fieldErrors?: Record<string, string[] | undefined>,
): AdminActionState {
  return { ok: false, code, message: adminUserMessage(code), fieldErrors }
}

function revalidateCatalog(productId?: string, slug?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/products')
  revalidatePath('/products')
  revalidatePath('/', 'layout')
  if (productId) revalidatePath(`/admin/products/${productId}`)
  if (slug) revalidatePath(`/products/${slug}`)
}

async function assertAdmin(): Promise<AdminSession | AdminActionState> {
  try {
    return await requireAdminSession('products')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

async function writeAudit(
  action: string,
  entityId: string | null,
  payload: Record<string, unknown>,
  actorLabel: string,
) {
  try {
    await getSupabaseAdminClient().from('admin_audit_logs').insert({
      action,
      entity_type: 'product',
      entity_id: entityId,
      payload,
      actor_label: actorLabel,
    })
  } catch {
    // Audit table may not exist until migration applied; don't fail business action.
  }
}

function salePriceValue(raw: number | '' | undefined): number | null {
  if (raw === '' || raw === undefined) return null
  return Number(raw)
}

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
    admin.actorLabel,
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
    admin.actorLabel,
  )
  revalidateCatalog(productId, parsed.data.slug)
  return { ok: true, message: 'Đã lưu sản phẩm.' }
}

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
    admin.actorLabel,
  )
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã lưu biến thể.' }
}

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

  await writeAudit('image_delete', productId, { image_id: parsed.data.imageId }, admin.actorLabel)
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã xóa ảnh.' }
}

export async function upsertSpec(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = specUpsertSchema.safeParse({
    specId: formData.get('specId') ?? '',
    groupName: formData.get('groupName'),
    label: formData.get('label'),
    value: formData.get('value'),
    sortOrder: formData.get('sortOrder') ?? 0,
  })
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)
  }

  const db = getSupabaseAdminClient()
  const payload = {
    product_id: productId,
    group_name: parsed.data.groupName,
    label: parsed.data.label,
    value: parsed.data.value,
    sort_order: parsed.data.sortOrder,
  }

  if (parsed.data.specId) {
    const { error } = await db.from('product_specs').update(payload).eq('id', parsed.data.specId)
    if (error) return fail('INTERNAL_ERROR')
  } else {
    const { error } = await db.from('product_specs').insert(payload)
    if (error) return fail('INTERNAL_ERROR')
  }

  await writeAudit(
    parsed.data.specId ? 'spec_update' : 'spec_create',
    productId,
    { group_name: parsed.data.groupName, label: parsed.data.label, value: parsed.data.value },
    admin.actorLabel,
  )
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã lưu thông số.' }
}

export async function deleteSpec(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = specDeleteSchema.safeParse({ specId: formData.get('specId') })
  if (!parsed.success) return fail('VALIDATION_ERROR')

  const { error } = await getSupabaseAdminClient()
    .from('product_specs')
    .delete()
    .eq('id', parsed.data.specId)
    .eq('product_id', productId)
  if (error) return fail('INTERNAL_ERROR')

  await writeAudit('spec_delete', productId, { spec_id: parsed.data.specId }, admin.actorLabel)
  revalidateCatalog(productId)
  return { ok: true, message: 'Đã xóa thông số.' }
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

  await writeAudit('product_archive', productId, { archived }, admin.actorLabel)
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

  await writeAudit('product_bulk_update', null, { action, count: ids.length }, admin.actorLabel)
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

export async function replaceUseCases(
  productId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertAdmin()
  if (!('actorLabel' in admin)) return admin

  const parsed = useCasesSchema.safeParse({ useCases: formData.get('useCases') ?? '' })
  if (!parsed.success) return fail('VALIDATION_ERROR')

  const tags = parsed.data.useCases
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20)

  const db = getSupabaseAdminClient()
  const { error: delError } = await db.from('product_use_cases').delete().eq('product_id', productId)
  if (delError) return fail('INTERNAL_ERROR')

  if (tags.length > 0) {
    const { error } = await db.from('product_use_cases').insert(
      tags.map((use_case) => ({ product_id: productId, use_case })),
    )
    if (error) return fail('INTERNAL_ERROR')
  }

  revalidateCatalog(productId)
  return { ok: true, message: 'Đã lưu use cases.' }
}
