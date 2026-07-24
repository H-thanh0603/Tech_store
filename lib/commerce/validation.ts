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
  province: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  ward: z.string().trim().min(1).max(100),
  streetAddress: z.string().trim().min(5).max(240),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  paymentMethod: z.enum(['cod', 'bank_transfer']),
  idempotencyKey: postgresUuidSchema,
})

export const trackingSchema = z.object({
  orderCode: z.string().trim().min(1).max(64).transform((code) => code.toUpperCase()),
  phone: vietnameseMobileSchema,
})

export type CartItemInput = z.infer<typeof cartItemSchema>
export type CouponCodeInput = z.infer<typeof couponCodeSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type TrackingInput = z.infer<typeof trackingSchema>
