import type { FulfillmentMethod, OrderStatus, PaymentMethod, PaymentStatus, PickupStore } from '@/lib/commerce/types'

export type AdminActionState<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | {
      ok: false
      code: string
      message: string
      fieldErrors?: Record<string, string[] | undefined>
    }

export interface DashboardStats {
  newOrders7d: number
  pendingOrders: number
  lowStockCount: number
  draftProducts: number
  revenue7d: number
}

export type DashboardChartRange = 7 | 30 | 90

export interface DashboardKpis {
  revenueToday: number
  revenueYesterday: number
  revenueMonth: number
  revenuePrevMonth: number
  ordersToday: number
  ordersYesterday: number
  pendingOrders: number
  aovMonth: number
  monthOrderCount: number
  lowStockCount: number
  outOfStockCount: number
  timezone: string
}

export interface RevenueDayRow {
  date: string
  revenue: number
  orderCount: number
}

export interface OrdersByStatusRow {
  status: string
  count: number
}

export interface RevenueByCategoryRow {
  categoryId: string
  categoryName: string
  revenue: number
  quantity: number
}

export interface TopProductRow {
  productName: string
  sku: string
  quantity: number
  revenue: number
}

export type FunnelStage = 'search' | 'product' | 'cart' | 'checkout' | 'order'

export interface FunnelStageRow {
  stage: FunnelStage
  count: number
}

export interface StockAlertRow {
  productId: string
  productName: string
  sku: string
  available: number
  threshold: number
  status: 'low_stock' | 'out_of_stock'
}

export interface RecentOrderRow {
  orderCode: string
  customerName: string
  orderStatus: string
  paymentStatus: string
  total: number
  createdAt: string
}

export interface AdminCategoryRow {
  id: string
  name: string
  slug: string
  parentId: string | null
  parentName: string | null
  isActive: boolean
  productCount: number
  updatedAt: string
}

export interface AdminBrandRow {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  isActive: boolean
  productCount: number
  updatedAt: string
}

export type InventoryStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface InventoryListRow {
  inventoryId: string
  variantId: string
  productId: string
  productName: string
  sku: string
  attributes: Record<string, string>
  onHand: number
  reserved: number
  available: number
  threshold: number
  stockStatus: InventoryStockStatus
  categoryName: string | null
  brandName: string | null
  imageUrl: string | null
  updatedAt: string
}

export interface InventoryListResult {
  total: number
  page: number
  pageSize: number
  pageCount: number
  rows: InventoryListRow[]
}

export interface InventoryAdjustmentRow {
  id: string
  previousQuantity: number
  delta: number
  newQuantity: number
  reasonCode: string
  note: string | null
  actorLabel: string
  createdAt: string
}

export interface StoreInventoryRow {
  storeId: string
  storeName: string
  address: string
  quantity: number
  available: number
}

export interface AdminProductListItem {
  id: string
  name: string
  slug: string
  isPublished: boolean
  isFeatured: boolean
  isArchived: boolean
  categoryName: string | null
  brandName: string | null
  variantCount: number
  minAvailable: number | null
  updatedAt: string
  imageUrl?: string | null
  totalAvailable?: number | null
  minPrice?: number | null
  maxPrice?: number | null
}

export interface AdminProductListResult {
  total: number
  page: number
  pageSize: number
  pageCount: number
  rows: AdminProductListItem[]
}

export interface AdminVariantRow {
  id: string
  sku: string
  attributes: Record<string, string>
  regularPrice: number
  salePrice: number | null
  isActive: boolean
  quantity: number
  reservedQuantity: number
  lowStockThreshold: number
  available: number
}

export interface AdminImageRow {
  id: string
  url: string
  altText: string | null
  sortOrder: number
  variantId: string | null
}

export interface AdminSpecRow {
  id: string
  groupName: string
  label: string
  value: string
  sortOrder: number
}

export interface AdminProductDetail {
  id: string
  name: string
  slug: string
  description: string | null
  categoryId: string
  brandId: string | null
  isPublished: boolean
  isFeatured: boolean
  isArchived: boolean
  variants: AdminVariantRow[]
  images: AdminImageRow[]
  specs: AdminSpecRow[]
  useCases: string[]
}

export interface CategoryOption {
  id: string
  name: string
  slug: string
}

export interface BrandOption {
  id: string
  name: string
  slug: string
}

export interface AdminOrderListItem {
  orderCode: string
  customerName: string
  customerPhone: string
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  total: number
  createdAt: string
  updatedAt?: string
}

export interface AdminOrderListResult {
  total: number
  page: number
  pageSize: number
  pageCount: number
  rows: AdminOrderListItem[]
}

export interface OrderStatusEvent {
  id: string
  fromStatus: string | null
  toStatus: string
  eventType: 'order_status' | 'payment_status'
  reason: string | null
  actorLabel: string
  createdAt: string
}

export interface OrderInternalNote {
  id: string
  body: string
  actorLabel: string
  createdAt: string
}

export interface AdminOrderDetail extends AdminOrderListItem {
  fulfillmentMethod: FulfillmentMethod
  pickupStore: PickupStore | null
  customerEmail: string | null
  address: {
    province: string
    district: string
    ward: string
    streetAddress: string
  }
  note: string | null
  subtotal: number
  discountTotal: number
  shippingTotal: number
  transferExpiresAt: string | null
  couponCode: string | null
  items: Array<{
    productName: string
    sku: string
    attributes: Record<string, string>
    unitPrice: number
    quantity: number
    lineTotal: number
  }>
  statusEvents?: OrderStatusEvent[]
  internalNotes?: OrderInternalNote[]
}

export interface AdminCustomerRow {
  key: string
  name: string
  phone: string
  email: string | null
  orderCount: number
  totalSpent: number
  lastOrderAt: string
  lastOrderCode: string
}

export interface AdminCustomerListResult {
  total: number
  page: number
  pageSize: number
  pageCount: number
  rows: AdminCustomerRow[]
  source: string
}

export interface AdminCouponRow {
  id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minimumOrder: number
  maximumDiscount: number | null
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
}
