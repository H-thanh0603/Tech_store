import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import type { AdminOrderDetail, AdminOrderListItem, AdminOrderListResult } from '@/lib/admin/types'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/commerce/types'
import { asRecord, num } from './shared'

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
      fulfillment_method, pickup_store_id,
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
  const [eventsRes, notesRes, storeRes] = await Promise.all([
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
    data.pickup_store_id
      ? db
          .from('stores')
          .select('id, name, phone, province, district, street_address, opening_hours')
          .eq('id', data.pickup_store_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (storeRes.error) throw storeRes.error
  const store = storeRes.data

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
    fulfillmentMethod: data.fulfillment_method === 'pickup' ? 'pickup' : 'delivery',
    pickupStore: store
      ? {
          id: String(store.id),
          name: String(store.name),
          phone: store.phone == null ? null : String(store.phone),
          province: String(store.province),
          district: String(store.district),
          address: String(store.street_address),
          openingHours: String(store.opening_hours),
        }
      : null,
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
