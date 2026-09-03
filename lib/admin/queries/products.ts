import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminProductDetail, AdminProductListItem, AdminProductListResult } from '@/lib/admin/types'
import { asRecord, num } from './shared'

export async function listAdminProducts(filter?: {
  status?: 'all' | 'published' | 'draft' | 'archived'
  q?: string
  categoryId?: string
  brandId?: string
  stock?: 'all' | 'in' | 'low' | 'out'
  sort?: 'name' | 'updated_at' | 'stock' | 'price'
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}): Promise<AdminProductListResult> {
  const db = getSupabaseAdminClient()
  const { data, error } = await db.rpc('admin_list_products', {
    p_search: filter?.q || null,
    p_status: filter?.status ?? 'all',
    p_category_id: filter?.categoryId || null,
    p_brand_id: filter?.brandId || null,
    p_stock: filter?.stock ?? 'all',
    p_sort: filter?.sort ?? 'updated_at',
    p_sort_dir: filter?.dir ?? 'desc',
    p_page: filter?.page ?? 1,
    p_page_size: filter?.pageSize ?? 20,
  })
  if (error) throw error

  const root = asRecord(data)
  const rows = (Array.isArray(root.rows) ? root.rows : []).map((item) => {
    const row = asRecord(item)
    const totalAvailable = row.totalAvailable == null ? null : num(row.totalAvailable)
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      isPublished: Boolean(row.isPublished),
      isFeatured: Boolean(row.isFeatured),
      isArchived: Boolean(row.isArchived),
      categoryName: row.categoryName == null ? null : String(row.categoryName),
      brandName: row.brandName == null ? null : String(row.brandName),
      variantCount: num(row.variantCount),
      minAvailable: totalAvailable,
      totalAvailable,
      imageUrl: row.imageUrl == null ? null : String(row.imageUrl),
      minPrice: row.minPrice == null ? null : num(row.minPrice),
      maxPrice: row.maxPrice == null ? null : num(row.maxPrice),
      updatedAt: String(row.updatedAt),
    } satisfies AdminProductListItem
  })

  return {
    total: num(root.total),
    page: num(root.page) || 1,
    pageSize: num(root.pageSize) || 20,
    pageCount: Math.max(1, num(root.pageCount) || 1),
    rows,
  }
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  const db = getSupabaseAdminClient()
  const { data, error } = await db
    .from('products')
    .select(
      `
      id, name, slug, description, category_id, brand_id,
      is_published, is_featured, is_archived,
      product_variants (
        id, sku, attributes, regular_price, sale_price, is_active,
        inventory ( quantity, reserved_quantity, low_stock_threshold )
      ),
      product_images ( id, url, alt_text, sort_order, variant_id ),
      product_specs ( id, group_name, label, value, sort_order ),
      product_use_cases ( use_case )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const variants = ((data.product_variants as Array<Record<string, unknown>> | null) ?? []).map(
    (v) => {
      const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory
      const invRec = asRecord(inv)
      const quantity = num(invRec.quantity)
      const reservedQuantity = num(invRec.reserved_quantity)
      const attrs = asRecord(v.attributes)
      const attributes: Record<string, string> = {}
      for (const [k, val] of Object.entries(attrs)) attributes[k] = String(val)
      return {
        id: String(v.id),
        sku: String(v.sku),
        attributes,
        regularPrice: num(v.regular_price),
        salePrice: v.sale_price == null ? null : num(v.sale_price),
        isActive: Boolean(v.is_active),
        quantity,
        reservedQuantity,
        lowStockThreshold: num(invRec.low_stock_threshold ?? 5),
        available: quantity - reservedQuantity,
      }
    },
  )

  const images = ((data.product_images as Array<Record<string, unknown>> | null) ?? [])
    .map((img) => ({
      id: String(img.id),
      url: String(img.url),
      altText: img.alt_text == null ? null : String(img.alt_text),
      sortOrder: num(img.sort_order),
      variantId: img.variant_id == null ? null : String(img.variant_id),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const specs = ((data.product_specs as Array<Record<string, unknown>> | null) ?? [])
    .map((s) => ({
      id: String(s.id),
      groupName: String(s.group_name),
      label: String(s.label),
      value: String(s.value),
      sortOrder: num(s.sort_order),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const useCases = ((data.product_use_cases as Array<Record<string, unknown>> | null) ?? []).map(
    (u) => String(u.use_case),
  )

  return {
    id: String(data.id),
    name: String(data.name),
    slug: String(data.slug),
    description: data.description == null ? null : String(data.description),
    categoryId: String(data.category_id),
    brandId: data.brand_id == null ? null : String(data.brand_id),
    isPublished: Boolean(data.is_published),
    isFeatured: Boolean(data.is_featured),
    isArchived: Boolean(data.is_archived),
    variants,
    images,
    specs,
    useCases,
  }
}
