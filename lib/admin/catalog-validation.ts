import { z } from 'zod'

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm a-z, 0-9 và dấu gạch ngang.')

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'ID không hợp lệ.')

export const categoryUpsertSchema = z.object({
  id: uuid.optional().or(z.literal('')),
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  parentId: uuid.optional().or(z.literal('')),
  isActive: z.coerce.boolean().optional().default(true),
})

export const brandUpsertSchema = z.object({
  id: uuid.optional().or(z.literal('')),
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  logoUrl: z.string().trim().url().max(1000).optional().or(z.literal('')),
  isActive: z.coerce.boolean().optional().default(true),
})

export const inventoryAdjustSchema = z.object({
  variantId: uuid,
  /** Signed delta when mode is omitted/manual. */
  delta: z.coerce.number().int().min(-1_000_000).max(1_000_000).optional(),
  amount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  mode: z.enum(['restock', 'reduce', 'set']).optional(),
  reasonCode: z.enum(['restock', 'correction', 'damaged', 'returned', 'manual_adjustment']),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  expectedQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).optional(),
})

export const inventoryThresholdSchema = z.object({
  variantId: uuid,
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000),
})

export const storeInventorySetSchema = z.object({
  storeId: uuid,
  variantId: uuid,
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  expectedQuantity: z.coerce.number().int().min(0).max(1_000_000),
})

export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>
export type BrandUpsertInput = z.infer<typeof brandUpsertSchema>
export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>
