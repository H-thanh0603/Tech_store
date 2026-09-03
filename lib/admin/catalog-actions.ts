'use server'

import { revalidatePath, updateTag } from 'next/cache'

import {
  requireAdminPermission,
  requireAdminSession,
  type AdminSession,
} from '@/lib/admin/auth'
import {
  brandUpsertSchema,
  categoryUpsertSchema,
  inventoryAdjustSchema,
  inventoryThresholdSchema,
  storeInventorySetSchema,
} from '@/lib/admin/catalog-validation'
import { adminUserMessage } from '@/lib/admin/errors'
import type { AdminModule, AdminPermission } from '@/lib/admin/permissions'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminActionState } from '@/lib/admin/types'

function fail(
  code: string,
  fieldErrors?: Record<string, string[] | undefined>,
  message?: string,
): AdminActionState {
  return {
    ok: false,
    code,
    message: message ?? adminUserMessage(code),
    fieldErrors,
  }
}

// Kept for non-audited admin gates
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function assertAdmin(module: AdminModule): Promise<AdminActionState | null> {
  try {
    await requireAdminSession(module)
    return null
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

async function assertPermission(
  permission: AdminPermission,
): Promise<AdminSession | AdminActionState> {
  try {
    return await requireAdminPermission(permission)
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
}

function revalidateCatalogAdmin() {
  revalidatePath('/admin/categories')
  revalidatePath('/admin/brands')
  revalidatePath('/admin/inventory')
  revalidatePath('/admin/products')
  revalidatePath('/admin')
  revalidatePath('/products')
  revalidatePath('/', 'layout')
  updateTag('catalog-facets')
}

async function writeCatalogAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  payload: Record<string, unknown>,
  actor: AdminSession,
) {
  try {
    await getSupabaseAdminClient().from('admin_audit_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      actor_label: actor.actorLabel,
      actor_user_id: actor.userId,
    })
  } catch {
    // Audit must never block business action
  }
}

export async function upsertCategory(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let actor: AdminSession
  try {
    actor = await requireAdminSession('categories')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }
  const parsed = categoryUpsertSchema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name'),
    slug: formData.get('slug'),
    parentId: formData.get('parentId') ?? '',
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const parentId = parsed.data.parentId || null
  if (parentId && parsed.data.id && parentId === parsed.data.id) {
    return fail('VALIDATION_ERROR', { parentId: ['Danh mục không thể là cha của chính nó.'] })
  }

  const db = getSupabaseAdminClient()

  if (parentId && parsed.data.id) {
    // Prevent simple 1-level cycle: parent cannot already be a child of this node.
    const { data: parent } = await db
      .from('categories')
      .select('parent_id')
      .eq('id', parentId)
      .maybeSingle()
    if (parent?.parent_id && String(parent.parent_id) === parsed.data.id) {
      return fail('VALIDATION_ERROR', { parentId: ['Không tạo chu trình danh mục.'] })
    }
  }

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    parent_id: parentId,
    is_active: parsed.data.isActive ?? true,
  }

  if (parsed.data.id) {
    const { error } = await db.from('categories').update(payload).eq('id', parsed.data.id)
    if (error) {
      if (error.code === '23505') return fail('SLUG_TAKEN')
      return fail('INTERNAL_ERROR')
    }
  } else {
    const { error } = await db.from('categories').insert(payload)
    if (error) {
      if (error.code === '23505') return fail('SLUG_TAKEN')
      return fail('INTERNAL_ERROR')
    }
  }

  await writeCatalogAudit(
    parsed.data.id ? 'category_update' : 'category_create',
    'category',
    parsed.data.id || null,
    { name: payload.name, slug: payload.slug },
    actor,
  )
  revalidateCatalogAdmin()
  return { ok: true, message: 'Đã lưu danh mục.' }
}

export async function setCategoryActive(
  categoryId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  let actor: AdminSession
  try {
    actor = await requireAdminSession('categories')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }

  const { error } = await getSupabaseAdminClient()
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', categoryId)
  if (error) return fail('INTERNAL_ERROR')

  await writeCatalogAudit('category_toggle', 'category', categoryId, { is_active: isActive }, actor)
  revalidateCatalogAdmin()
  return { ok: true, message: isActive ? 'Đã kích hoạt danh mục.' : 'Đã tắt danh mục.' }
}

export async function deleteCategory(categoryId: string): Promise<AdminActionState> {
  let actor: AdminSession
  try {
    actor = await requireAdminSession('categories')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }

  const db = getSupabaseAdminClient()
  const { count, error: countError } = await db
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
  if (countError) return fail('INTERNAL_ERROR')
  if ((count ?? 0) > 0) {
    return fail('HAS_ORDERS', undefined, 'Danh mục còn sản phẩm — hãy chuyển sản phẩm trước.')
  }

  const { error } = await db.from('categories').delete().eq('id', categoryId)
  if (error) return fail('INTERNAL_ERROR')

  await writeCatalogAudit('category_delete', 'category', categoryId, {}, actor)
  revalidateCatalogAdmin()
  return { ok: true, message: 'Đã xóa danh mục.' }
}

export async function upsertBrand(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let actor: AdminSession
  try {
    actor = await requireAdminSession('brands')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }

  const parsed = brandUpsertSchema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name'),
    slug: formData.get('slug'),
    logoUrl: formData.get('logoUrl') ?? '',
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    logo_url: parsed.data.logoUrl || null,
    is_active: parsed.data.isActive ?? true,
  }

  const db = getSupabaseAdminClient()
  if (parsed.data.id) {
    const { error } = await db.from('brands').update(payload).eq('id', parsed.data.id)
    if (error) {
      if (error.code === '23505') return fail('SLUG_TAKEN')
      return fail('INTERNAL_ERROR')
    }
  } else {
    const { error } = await db.from('brands').insert(payload)
    if (error) {
      if (error.code === '23505') return fail('SLUG_TAKEN')
      return fail('INTERNAL_ERROR')
    }
  }

  await writeCatalogAudit(
    parsed.data.id ? 'brand_update' : 'brand_create',
    'brand',
    parsed.data.id || null,
    { name: payload.name, slug: payload.slug },
    actor,
  )
  revalidateCatalogAdmin()
  return { ok: true, message: 'Đã lưu thương hiệu.' }
}

export async function setBrandActive(brandId: string, isActive: boolean): Promise<AdminActionState> {
  let actor: AdminSession
  try {
    actor = await requireAdminSession('brands')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }

  const { error } = await getSupabaseAdminClient()
    .from('brands')
    .update({ is_active: isActive })
    .eq('id', brandId)
  if (error) return fail('INTERNAL_ERROR')

  await writeCatalogAudit('brand_toggle', 'brand', brandId, { is_active: isActive }, actor)
  revalidateCatalogAdmin()
  return { ok: true, message: isActive ? 'Đã kích hoạt thương hiệu.' : 'Đã tắt thương hiệu.' }
}

export async function deleteBrand(brandId: string): Promise<AdminActionState> {
  let actor: AdminSession
  try {
    actor = await requireAdminSession('brands')
  } catch (error) {
    return fail(error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAUTHORIZED')
  }

  const db = getSupabaseAdminClient()
  const { count, error: countError } = await db
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
  if (countError) return fail('INTERNAL_ERROR')
  if ((count ?? 0) > 0) {
    return fail('HAS_ORDERS', undefined, 'Thương hiệu còn sản phẩm — không xóa được.')
  }

  const { error } = await db.from('brands').delete().eq('id', brandId)
  if (error) return fail('INTERNAL_ERROR')

  await writeCatalogAudit('brand_delete', 'brand', brandId, {}, actor)
  revalidateCatalogAdmin()
  return { ok: true, message: 'Đã xóa thương hiệu.' }
}

export async function adjustInventory(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertPermission('inventory.adjust')
  if (!('actorLabel' in admin)) return admin

  const expectedRaw = formData.get('expectedQuantity')
  const thresholdRaw = formData.get('lowStockThreshold')
  const amountRaw = formData.get('amount')
  const deltaRaw = formData.get('delta')

  const parsed = inventoryAdjustSchema.safeParse({
    variantId: formData.get('variantId'),
    delta: deltaRaw === null || deltaRaw === '' ? undefined : Number(deltaRaw),
    amount: amountRaw === null || amountRaw === '' ? undefined : Number(amountRaw),
    mode: formData.get('mode') || undefined,
    reasonCode: formData.get('reasonCode'),
    note: formData.get('note') ?? '',
    expectedQuantity:
      expectedRaw === null || expectedRaw === '' ? undefined : Number(expectedRaw),
    lowStockThreshold:
      thresholdRaw === null || thresholdRaw === '' ? undefined : Number(thresholdRaw),
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  let delta = parsed.data.delta
  if (parsed.data.mode && parsed.data.amount != null && parsed.data.expectedQuantity != null) {
    if (parsed.data.mode === 'restock') delta = parsed.data.amount
    else if (parsed.data.mode === 'reduce') delta = -parsed.data.amount
    else delta = parsed.data.amount - parsed.data.expectedQuantity
  }
  if (delta == null || delta === 0) {
    return fail('VALIDATION_ERROR', { delta: ['Delta phải khác 0.'] })
  }

  const { data, error } = await getSupabaseAdminClient().rpc('admin_adjust_inventory', {
    p_variant_id: parsed.data.variantId,
    p_delta: delta,
    p_reason_code: parsed.data.reasonCode,
    p_note: parsed.data.note || null,
    p_actor_label: admin.actorLabel,
    p_expected_quantity: parsed.data.expectedQuantity ?? null,
    p_low_stock_threshold: parsed.data.lowStockThreshold ?? null,
  })
  if (error) return fail('INTERNAL_ERROR')

  const result = data as { code?: string; message?: string } | null
  if (!result || result.code !== 'OK') {
    const code = result?.code ?? 'INTERNAL_ERROR'
    return fail(code, undefined, result?.message)
  }

  revalidateCatalogAdmin()
  return { ok: true, message: 'Đã điều chỉnh tồn kho.' }
}

export async function updateInventoryThreshold(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertPermission('inventory.adjust')
  if (!('actorLabel' in admin)) return admin

  const parsed = inventoryThresholdSchema.safeParse({
    variantId: formData.get('variantId'),
    lowStockThreshold: formData.get('lowStockThreshold'),
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const { error } = await getSupabaseAdminClient()
    .from('inventory')
    .update({ low_stock_threshold: parsed.data.lowStockThreshold })
    .eq('variant_id', parsed.data.variantId)
  if (error) return fail('INTERNAL_ERROR')

  revalidateCatalogAdmin()
  return { ok: true, message: 'Đã cập nhật ngưỡng cảnh báo.' }
}

export async function setStoreStock(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await assertPermission('inventory.adjust')
  if (!('actorLabel' in admin)) return admin

  const parsed = storeInventorySetSchema.safeParse({
    storeId: formData.get('storeId'),
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
    expectedQuantity: formData.get('expectedQuantity'),
  })
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.flatten().fieldErrors)

  const { data, error } = await getSupabaseAdminClient().rpc('admin_set_store_stock', {
    p_store_id: parsed.data.storeId,
    p_variant_id: parsed.data.variantId,
    p_quantity: parsed.data.quantity,
    p_expected_quantity: parsed.data.expectedQuantity,
    p_actor_label: admin.actorLabel,
  })
  if (error) return fail('INTERNAL_ERROR')
  const result = data as { code?: string; quantity?: number } | null
  if (result?.code !== 'OK') {
    const message = result?.code === 'EXCEEDS_NETWORK_STOCK'
      ? 'Phân bổ cửa hàng không được vượt tồn kho toàn hệ thống.'
      : result?.code === 'CONFLICT'
        ? 'Tồn kho cửa hàng vừa thay đổi. Tải lại rồi thử lại.'
        : undefined
    return fail(result?.code ?? 'INTERNAL_ERROR', undefined, message)
  }

  revalidateCatalogAdmin()
  return { ok: true, message: 'Đã cập nhật tồn kho cửa hàng.' }
}
