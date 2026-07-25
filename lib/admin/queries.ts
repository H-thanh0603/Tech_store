import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type {
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderListResult,
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
  q?: string
  paymentStatus?: PaymentStatus | 'all'
  paymentMethod?: PaymentMethod | 'all'
  dateFrom?: string
  dateTo?: string
  sort?: 'created_at' | 'total' | 'updated_at'
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}): Promise<AdminOrderListResult> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_orders', {
    p_search: filter?.q || null,
    p_order_status: filter?.status ?? 'all',
    p_payment_status: filter?.paymentStatus ?? 'all',
    p_payment_method: filter?.paymentMethod ?? 'all',
    p_date_from: filter?.dateFrom || null,
    p_date_to: filter?.dateTo || null,
    p_sort: filter?.sort ?? 'created_at',
    p_sort_dir: filter?.dir ?? 'desc',
    p_page: filter?.page ?? 1,
    p_page_size: filter?.pageSize ?? 20,
  })
  if (error) throw error

  const root = asRecord(data)
  const rows = (Array.isArray(root.rows) ? root.rows : []).map((item) => {
    const row = asRecord(item)
    return {
      orderCode: String(row.orderCode),
      customerName: String(row.customerName),
      customerPhone: String(row.customerPhone),
      paymentMethod: row.paymentMethod as PaymentMethod,
      paymentStatus: row.paymentStatus as PaymentStatus,
      orderStatus: row.orderStatus as OrderStatus,
      total: num(row.total),
      createdAt: String(row.createdAt),
      updatedAt: row.updatedAt == null ? undefined : String(row.updatedAt),
    } satisfies AdminOrderListItem
  })

  return {
    total: num(root.total),
    page: num(root.page) || 1,
    pageSize: num(root.pageSize) || 20,
    pageCount: Math.max(1, num(root.pageCount) || 1),
    rows,
  }
}

export async function getAdminOrder(orderCode: string): Promise<AdminOrderDetail | null> {
  const db = getSupabaseAdminClient()
  const { data, error } = await db
    .from('orders')
    .select(
      `
      id, order_code, customer_name, customer_phone, customer_email,
      address_snapshot, note, payment_method, payment_status, order_status,
      subtotal, discount_total, shipping_total, total, transfer_expires_at,
      coupon_snapshot, created_at, updated_at,
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

  const orderId = String(data.id)
  const [eventsRes, notesRes] = await Promise.all([
    db
      .from('order_status_events')
      .select('id, from_status, to_status, event_type, reason, actor_label, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    db
      .from('order_internal_notes')
      .select('id, body, actor_label, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ])

  const statusEvents = (eventsRes.data ?? []).map((row) => ({
    id: String(row.id),
    fromStatus: row.from_status == null ? null : String(row.from_status),
    toStatus: String(row.to_status),
    eventType:
      row.event_type === 'payment_status'
        ? ('payment_status' as const)
        : ('order_status' as const),
    reason: row.reason == null ? null : String(row.reason),
    actorLabel: String(row.actor_label),
    createdAt: String(row.created_at),
  }))

  const internalNotes = (notesRes.data ?? []).map((row) => ({
    id: String(row.id),
    body: String(row.body),
    actorLabel: String(row.actor_label),
    createdAt: String(row.created_at),
  }))

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
    updatedAt: data.updated_at == null ? undefined : String(data.updated_at),
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
    statusEvents,
    internalNotes,
  }
}

export async function listAdminCustomers(filter?: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<import('@/lib/admin/types').AdminCustomerListResult> {
  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_customers', {
    p_search: filter?.q || null,
    p_page: filter?.page ?? 1,
    p_page_size: filter?.pageSize ?? 20,
  })
  if (error) throw error
  const root = asRecord(data)
  const rows = (Array.isArray(root.rows) ? root.rows : []).map((item) => {
    const row = asRecord(item)
    return {
      key: String(row.key),
      name: String(row.name),
      phone: String(row.phone),
      email: row.email == null ? null : String(row.email),
      orderCount: num(row.orderCount),
      totalSpent: num(row.totalSpent),
      lastOrderAt: String(row.lastOrderAt),
      lastOrderCode: String(row.lastOrderCode),
    }
  })
  return {
    total: num(root.total),
    page: num(root.page) || 1,
    pageSize: num(root.pageSize) || 20,
    pageCount: Math.max(1, num(root.pageCount) || 1),
    rows,
    source: String(root.source ?? 'orders_aggregate'),
  }
}

export async function listAdminCoupons(): Promise<import('@/lib/admin/types').AdminCouponRow[]> {
  const db = getSupabaseAdminClient()
  const { data, error } = await db
    .from('coupons')
    .select(
      'id, code, discount_type, discount_value, minimum_order, maximum_discount, starts_at, ends_at, usage_limit, is_active, created_at',
    )
    .order('created_at', { ascending: false })
  if (error) throw error

  const ids = (data ?? []).map((row) => String(row.id))
  const usedMap = new Map<string, number>()
  if (ids.length > 0) {
    const { data: redemptions } = await db
      .from('coupon_redemptions')
      .select('coupon_id')
      .in('coupon_id', ids)
      .is('released_at', null)
    for (const row of redemptions ?? []) {
      const id = String(row.coupon_id)
      usedMap.set(id, (usedMap.get(id) ?? 0) + 1)
    }
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
    usedCount: usedMap.get(String(row.id)) ?? 0,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
  }))
}

export async function getAdminCoupon(id: string) {
  const coupons = await listAdminCoupons()
  return coupons.find((c) => c.id === id) ?? null
}
