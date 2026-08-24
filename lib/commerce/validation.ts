import { z } from 'zod'

const postgresUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'ID không hợp lệ.',
  )

const vietnameseMobileSchema = z
  .string()
  .trim()
  .regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/, 'Số điện thoại không hợp lệ.')

export const cartItemSchema = z.object({
  variantId: postgresUuidSchema,
  quantity: z.coerce.number().int().min(1).max(99),
})

export const couponCodeSchema = z.object({
  code: z.string().trim().min(1).max(50).transform((code) => code.toUpperCase()),
})

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: vietnameseMobileSchema,
  customerEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  province: z.string().trim().max(100).optional().or(z.literal('')),
  district: z.string().trim().max(100).optional().or(z.literal('')),
  ward: z.string().trim().max(100).optional().or(z.literal('')),
  streetAddress: z.string().trim().max(240).optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  paymentMethod: z.enum(['cod', 'bank_transfer', 'vnpay']),
  idempotencyKey: postgresUuidSchema,
  fulfillmentMethod: z.enum(['delivery', 'pickup']).default('delivery'),
  pickupStoreId: postgresUuidSchema.optional().or(z.literal('')),
}).superRefine((value, context) => {
  if (value.fulfillmentMethod === 'pickup') {
    if (!value.pickupStoreId) {
      context.addIssue({ code: 'custom', path: ['pickupStoreId'], message: 'Chọn cửa hàng nhận.' })
    }
    return
  }
  for (const [field, minimum] of [
    ['province', 1], ['district', 1], ['ward', 1], ['streetAddress', 5],
  ] as const) {
    if ((value[field] ?? '').length < minimum) {
      context.addIssue({ code: 'custom', path: [field], message: 'Thông tin giao hàng chưa đầy đủ.' })
    }
  }
})

export const trackingSchema = z.object({
  orderCode: z.string().trim().min(1).max(64).transform((code) => code.toUpperCase()),
  phone: vietnameseMobileSchema,
})

export type CartItemInput = z.infer<typeof cartItemSchema>
export type CouponCodeInput = z.infer<typeof couponCodeSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type TrackingInput = z.infer<typeof trackingSchema>
