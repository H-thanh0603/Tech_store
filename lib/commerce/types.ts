export type PaymentMethod = 'cod' | 'bank_transfer' | 'vnpay'
export type FulfillmentMethod = 'delivery' | 'pickup'

export interface PickupStore {
  id: string
  name: string
  phone: string | null
  province: string
  district: string
  address: string
  openingHours: string
}

export interface ProductPickupStore extends PickupStore {
  variants: Array<{ variantId: string; available: number }>
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired'

export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'confirmed'
  | 'packing'
  | 'shipping'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'return_requested'
  | 'returned'

export type CommerceErrorCode =
  | 'VALIDATION_ERROR'
  | 'CART_EMPTY'
  | 'CART_NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'PRODUCT_UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'PRICE_CHANGED'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'COUPON_EXHAUSTED'
  | 'COUPON_MINIMUM'
  | 'IDEMPOTENT_REPLAY'
  | 'ORDER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NOT_RETURNABLE'
  | 'RETURN_ALREADY_REQUESTED'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR'

export interface CouponInput {
  type: 'percentage' | 'fixed'
  value: number
  maximum: number | null
}

export type FieldErrors = Record<string, string[] | undefined>

export type ActionState<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | {
      ok: false
      code: CommerceErrorCode
      message: string
      fieldErrors?: FieldErrors
    }

export interface CartItemData {
  id: string
  variantId: string
  productName: string
  productSlug: string
  sku: string
  attributes: Record<string, string>
  quantity: number
  priceAtAdd: number
  currentPrice: number
  lineTotal: number
  availableStock: number
  priceChanged: boolean
  outOfStock: boolean
  imageUrl: string | null
  imageAlt: string | null
}

export interface CartData {
  items: CartItemData[]
  itemCount: number
  subtotal: number
  discountTotal: number
  shippingTotal: number
  total: number
  appliedCouponCode: string | null
  canCheckout: boolean
  shippingInfo?: ShippingInfo | null
}

export interface ShippingInfo {
  shippingTotal: number
  rateName: string
  freeThreshold: number
  baseRate: number
  perItemRate: number
  isFree: boolean
}

export interface OrderItemData {
  productName: string
  sku: string
  attributes: Record<string, string>
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface OrderConfirmationData {
  orderCode: string
  customerPhone?: string
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  subtotal: number
  discountTotal: number
  shippingTotal: number
  total: number
  transferExpiresAt: string | null
  fulfillmentMethod: FulfillmentMethod
  pickupStore: PickupStore | null
  items: OrderItemData[]
}
