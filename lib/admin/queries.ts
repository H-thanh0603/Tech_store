import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type {
  AdminOrderDetail,
  AdminOrderListItem,
  AdminProductDetail,
  AdminProductListItem,
  AdminProductListResult,
  BrandOption,
  CategoryOption,
  DashboardStats,
} from '@/lib/admin/types'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/commerce/types'

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getSupabaseAdminClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [orders7d, pending, drafts, lowStock] = await Promise.all([
    db.from('orders').select('total, created_at').gte('created_at', since),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('order_status', ['pending', 'awaiting_payment', 'confirmed', 'packing']),
    db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', false)
      .eq('is_archived', false),
    db.from('inventory').select('variant_id, quantity, reserved_quantity, low_stock_threshold'),
  ])

  if (orders7d.error) throw orders7d.error
  if (pending.error) throw pending.error
  if (drafts.error) throw drafts.error
  if (lowStock.error) throw lowStock.error

  const revenue7d = (orders7d.data ?? []).reduce((sum, row) => sum + num(row.total), 0)
  const lowStockCount = (lowStock.data ?? []).filter((row) => {
    const available = num(row.quantity) - num(row.reserved_quantity)
    return available <= num(row.low_stock_threshold)
  }).length

  return {
    newOrders7d: orders7d.data?.length ?? 0,
    pendingOrders: pending.count ?? 0,
    lowStockCount,
    draftProducts: drafts.count ?? 0,
    revenue7d,
  }
}

export async function listCategories(): Promise<CategoryOption[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
  }))
}

export async function listBrands(): Promise<BrandOption[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from('brands')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
  }))
}

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

export async function listAdminOrders(filter?: {
  status?: OrderStatus | 'all'
}): Promise<AdminOrderListItem[]> {
  let query = getSupabaseAdminClient()
    .from('orders')
    .select(
      'order_code, customer_name, customer_phone, payment_method, payment_status, order_status, total, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('order_status', filter.status)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => ({
    orderCode: String(row.order_code),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    orderStatus: row.order_status as OrderStatus,
    total: num(row.total),
    createdAt: String(row.created_at),
  }))
}

export async function getAdminOrder(orderCode: string): Promise<AdminOrderDetail | null> {
  const db = getSupabaseAdminClient()
  const { data, error } = await db
    .from('orders')
    .select(
      `
      order_code, customer_name, customer_phone, customer_email,
      address_snapshot, note, payment_method, payment_status, order_status,
      subtotal, discount_total, shipping_total, total, transfer_expires_at,
      coupon_snapshot, created_at,
      order_items ( product_name, sku, attributes, unit_price, quantity, line_total )
    `,
    )
    .eq('order_code', orderCode.toUpperCase())
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const address = asRecord(data.address_snapshot)
  const coupon = asRecord(data.coupon_snapshot)
  const items = ((data.order_items as Array<Record<string, unknown>> | null) ?? []).map((item) => {
    const attrs = asRecord(item.attributes)
    const attributes: Record<string, string> = {}
    for (const [k, val] of Object.entries(attrs)) attributes[k] = String(val)
    return {
      productName: String(item.product_name),
      sku: String(item.sku),
      attributes,
      unitPrice: num(item.unit_price),
      quantity: num(item.quantity),
      lineTotal: num(item.line_total),
    }
  })

  return {
    orderCode: String(data.order_code),
    customerName: String(data.customer_name),
    customerPhone: String(data.customer_phone),
    customerEmail: data.customer_email == null ? null : String(data.customer_email),
    paymentMethod: data.payment_method as PaymentMethod,
    paymentStatus: data.payment_status as PaymentStatus,
    orderStatus: data.order_status as OrderStatus,
    total: num(data.total),
    createdAt: String(data.created_at),
    address: {
      province: String(address.province ?? ''),
      district: String(address.district ?? ''),
      ward: String(address.ward ?? ''),
      streetAddress: String(address.streetAddress ?? ''),
    },
    note: data.note == null ? null : String(data.note),
    subtotal: num(data.subtotal),
    discountTotal: num(data.discount_total),
    shippingTotal: num(data.shipping_total),
    transferExpiresAt:
      data.transfer_expires_at == null ? null : String(data.transfer_expires_at),
    couponCode: coupon.code ? String(coupon.code) : null,
    items,
  }
}
