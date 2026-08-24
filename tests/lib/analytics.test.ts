import { describe, expect, it } from 'vitest'

import { sanitizeAnalyticsPayload } from '@/lib/analytics'

describe('sanitizeAnalyticsPayload', () => {
  it('removes PII-shaped keys and keeps bounded aggregate values', () => {
    expect(
      sanitizeAnalyticsPayload({
        email: 'buyer@example.com',
        searchTerm: 'private text',
        productId: 'product-1',
        total: 12_000_000,
        source: 'x'.repeat(200),
      }),
    ).toEqual({
      productId: 'product-1',
      total: 12_000_000,
      source: 'x'.repeat(160),
    })
  })
})
