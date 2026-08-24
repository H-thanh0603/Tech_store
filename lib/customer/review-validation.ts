import { z } from 'zod'

export const productReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().transform((value) => value || undefined),
  body: z.string().trim().min(1).max(2000),
})
