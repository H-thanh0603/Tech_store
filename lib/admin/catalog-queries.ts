import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type {
  AdminBrandRow,
  AdminCategoryRow,
  InventoryAdjustmentRow,
  InventoryListResult,
  InventoryListRow,
} from '@/lib/admin/types'

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export async function listAdminCategories(filter?: {
  q?: string
  active?: 'all' | 'active' | 'inactive'
}): Promise<AdminCategoryRow[]> {
  const db = getSupabaseAdminClient()
  let query = db
    .from('categories')
    .select('id, name, slug, parent_id, is_active, updated_at, products(count)')
    .order('name', { ascending: true })

  if (filter?.active === 'active') query = query.eq('is_active', true)
  if (filter?.active === 'inactive') query = query.eq('is_active', false)
  if (filter?.q) query = query.or(`name.ilike.%${filter.q}%,slug.ilike.%${filter.q}%`)

  const { data, error } = await query
  if (error) throw error

  const parentNames = new Map<string, string>()
  for (const row of data ?? []) {
    parentNames.set(String(row.id), String(row.name))
  }

  return (data ?? []).map((row) => {
    const countRaw = Array.isArray(row.products) ? row.products[0] : row.products
    const countRec = asRecord(countRaw)
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      parentId: row.parent_id == null ? null : String(row.parent_id),
      parentName: row.parent_id == null ? null : (parentNames.get(String(row.parent_id)) ?? null),
      isActive: Boolean(row.is_active),
      productCount: num(countRec.count),
      updatedAt: String(row.updated_at),
    }
  })
}

export async function listAdminBrands(filter?: {
  q?: string
  active?: 'all' | 'active' | 'inactive'
}): Promise<AdminBrandRow[]> {
  const db = getSupabaseAdminClient()
  let query = db
    .from('brands')
    .select('id, name, slug, logo_url, is_active, updated_at, products(count)')
    .order('name', { ascending: true })

  if (filter?.active === 'active') query = query.eq('is_active', true)
  if (filter?.active === 'inactive') query = query.eq('is_active', false)
  if (filter?.q) query = query.or(`name.ilike.%${filter.q}%,slug.ilike.%${filter.q}%`)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => {
    const countRaw = Array.isArray(row.products) ? row.products[0] : row.products
    const countRec = asRecord(countRaw)
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      logoUrl: row.logo_url == null ? null : String(row.logo_url),
      isActive: Boolean(row.is_active),
      productCount: num(countRec.count),
      updatedAt: String(row.updated_at),
    }
  })
}

export async function listAdminInventory(filter?: {
  q?: string
  stock?: 'all' | 'in' | 'low' | 'out'
  categoryId?: string
  brandId?: string
  sort?: 'updated_at' | 'available' | 'sku' | 'name'
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}): Promise<InventoryListResult> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_inventory', {
    p_search: filter?.q || null,
    p_stock: filter?.stock ?? 'all',
    p_category_id: filter?.categoryId || null,
    p_brand_id: filter?.brandId || null,
    p_sort: filter?.sort ?? 'updated_at',
    p_sort_dir: filter?.dir ?? 'desc',
    p_page: filter?.page ?? 1,
    p_page_size: filter?.pageSize ?? 20,
  })
  if (error) throw error

  const root = asRecord(data)
  const rows: InventoryListRow[] = (Array.isArray(root.rows) ? root.rows : []).map((item) => {
    const row = asRecord(item)
    const attrs = asRecord(row.attributes)
    const attributes: Record<string, string> = {}
    for (const [k, v] of Object.entries(attrs)) attributes[k] = String(v)
    return {
      inventoryId: String(row.inventoryId),
      variantId: String(row.variantId),
      productId: String(row.productId),
      productName: String(row.productName),
      sku: String(row.sku),
      attributes,
      onHand: num(row.onHand),
      reserved: num(row.reserved),
      available: num(row.available),
      threshold: num(row.threshold),
      stockStatus:
        row.stockStatus === 'out_of_stock'
          ? 'out_of_stock'
          : row.stockStatus === 'low_stock'
            ? 'low_stock'
            : 'in_stock',
      categoryName: row.categoryName == null ? null : String(row.categoryName),
      brandName: row.brandName == null ? null : String(row.brandName),
      imageUrl: row.imageUrl == null ? null : String(row.imageUrl),
      updatedAt: String(row.updatedAt),
    }
  })

  return {
    total: num(root.total),
    page: num(root.page) || 1,
    pageSize: num(root.pageSize) || 20,
    pageCount: Math.max(1, num(root.pageCount) || 1),
    rows,
  }
}

export async function listInventoryAdjustments(
  variantId: string,
  limit = 20,
): Promise<InventoryAdjustmentRow[]> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_inventory_adjustments', {
    p_variant_id: variantId,
    p_limit: limit,
  })
  if (error) throw error
  return (Array.isArray(data) ? data : []).map((item) => {
    const row = asRecord(item)
    return {
      id: String(row.id),
      previousQuantity: num(row.previousQuantity),
      delta: num(row.delta),
      newQuantity: num(row.newQuantity),
      reasonCode: String(row.reasonCode),
      note: row.note == null ? null : String(row.note),
      actorLabel: String(row.actorLabel),
      createdAt: String(row.createdAt),
    }
  })
}
