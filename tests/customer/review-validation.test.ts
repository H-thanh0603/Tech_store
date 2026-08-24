import { describe, expect, it } from 'vitest'

import { productReviewSchema } from '@/lib/customer/review-validation'

describe('product review validation', () => {
  it('accepts a 1–5 rating and useful review text', () => {
    expect(productReviewSchema.safeParse({
      productId: '40000000-0000-4000-8000-000000000001',
      rating: '5',
      title: 'Dùng tốt',
      body: 'Máy chạy ổn định và pin tốt.',
    }).success).toBe(true)
  })

  it('rejects out-of-range ratings and empty bodies', () => {
    expect(productReviewSchema.safeParse({
      productId: '40000000-0000-4000-8000-000000000001',
      rating: '6',
      title: '',
      body: '   ',
    }).success).toBe(false)
  })
})
