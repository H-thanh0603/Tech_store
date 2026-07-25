import { z } from 'zod'

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'ID không hợp lệ.')

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm a-z, 0-9 và dấu gạch ngang.')

const money = z.coerce.number().finite().min(0).max(999_999_999)

export const adminLoginSchema = z.object({
  secret: z.string().min(1, 'Nhập mật khẩu admin.'),
})

export const productUpsertSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugSchema,
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  categoryId: uuid,
  brandId: uuid.optional().or(z.literal('')),
  isPublished: z.coerce.boolean().optional().default(false),
  isFeatured: z.coerce.boolean().optional().default(false),
  isArchived: z.coerce.boolean().optional().default(false),
})

export const createProductSchema = productUpsertSchema.extend({
  sku: z.string().trim().min(2).max(64),
  regularPrice: money,
  salePrice: money.optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).default(5),
  attributesJson: z.string().trim().max(2000).optional().or(z.literal('')),
  imageUrl: z.string().trim().url().max(1000).optional().or(z.literal('')),
  imageAlt: z.string().trim().max(200).optional().or(z.literal('')),
})

export const variantUpsertSchema = z
  .object({
    variantId: uuid.optional().or(z.literal('')),
    sku: z.string().trim().min(2).max(64),
    regularPrice: money,
    salePrice: money.optional().or(z.literal('')),
    isActive: z.coerce.boolean().optional().default(true),
    quantity: z.coerce.number().int().min(0).max(1_000_000),
    lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).default(5),
    attributesJson: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.salePrice !== '' && value.salePrice !== undefined) {
      const sale = Number(value.salePrice)
      if (sale > value.regularPrice) {
        ctx.addIssue({
          code: 'custom',
          path: ['salePrice'],
          message: 'Giá sale không được lớn hơn giá gốc.',
        })
      }
    }
  })

export const inventoryUpdateSchema = z.object({
  variantId: uuid,
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000),
})

export const imageUpsertSchema = z.object({
  imageId: uuid.optional().or(z.literal('')),
  url: z.string().trim().url().max(1000),
  altText: z.string().trim().max(200).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  variantId: uuid.optional().or(z.literal('')),
})

export const imageDeleteSchema = z.object({
  imageId: uuid,
})

export const specUpsertSchema = z.object({
  specId: uuid.optional().or(z.literal('')),
  groupName: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(500),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})

export const specDeleteSchema = z.object({
  specId: uuid,
})

export const useCasesSchema = z.object({
  useCases: z.string().trim().max(1000),
})

export const orderStatusSchema = z
  .object({
    orderCode: z.string().trim().min(1).max(64),
    orderStatus: z.enum([
      'pending',
      'awaiting_payment',
      'confirmed',
      'packing',
      'shipping',
      'completed',
      'cancelled',
      'expired',
    ]),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (
      (value.orderStatus === 'cancelled' || value.orderStatus === 'expired') &&
      !value.reason?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Hủy đơn bắt buộc nhập lý do.',
      })
    }
  })

export const orderPaymentSchema = z.object({
  orderCode: z.string().trim().min(1).max(64),
  paymentStatus: z.enum(['paid']),
  alsoConfirmOrder: z.coerce.boolean().optional().default(false),
})

export const orderNoteSchema = z.object({
  orderCode: z.string().trim().min(1).max(64),
  body: z.string().trim().min(1).max(2000),
})

export const couponUpsertSchema = z
  .object({
    id: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .optional()
      .or(z.literal('')),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform((v) => v.toUpperCase().replace(/\s+/g, '')),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.coerce.number().finite().min(0).max(999_999_999),
    minimumOrder: z.coerce.number().finite().min(0).max(999_999_999).default(0),
    maximumDiscount: z.coerce.number().finite().min(0).max(999_999_999).optional().or(z.literal('')),
    startsAt: z.string().optional().or(z.literal('')),
    endsAt: z.string().optional().or(z.literal('')),
    usageLimit: z.coerce.number().int().min(1).max(1_000_000).optional().or(z.literal('')),
    isActive: z.coerce.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === 'percentage' && value.discountValue > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountValue'],
        message: 'Phần trăm giảm tối đa 100.',
      })
    }
    if (value.startsAt && value.endsAt) {
      const start = Date.parse(value.startsAt)
      const end = Date.parse(value.endsAt)
      if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
        ctx.addIssue({
          code: 'custom',
          path: ['endsAt'],
          message: 'Ngày kết thúc phải sau ngày bắt đầu.',
        })
      }
    }
  })

export function parseAttributesJson(raw: string | undefined | null): Record<string, string> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid')
    }
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new Error('invalid')
      }
      out[key] = String(value)
    }
    return out
  } catch {
    throw new Error('ATTRIBUTES_INVALID')
  }
}

export function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export type ProductUpsertInput = z.infer<typeof productUpsertSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type VariantUpsertInput = z.infer<typeof variantUpsertSchema>
