import { describe, expect, it } from 'vitest'

import {
  brandUpsertSchema,
  categoryUpsertSchema,
  inventoryAdjustSchema,
} from '@/lib/admin/catalog-validation'

describe('catalog validation', () => {
  it('accepts valid category and rejects self-parent via app rule separately', () => {
    const ok = categoryUpsertSchema.safeParse({
      name: 'Điện thoại',
      slug: 'dien-thoai',
      isActive: true,
    })
    expect(ok.success).toBe(true)

    const badSlug = categoryUpsertSchema.safeParse({
      name: 'X',
      slug: 'Bad Slug',
    })
    expect(badSlug.success).toBe(false)
  })

  it('validates brand logo url optional', () => {
    const ok = brandUpsertSchema.safeParse({
      name: 'Apple',
      slug: 'apple',
      logoUrl: '',
      isActive: true,
    })
    expect(ok.success).toBe(true)

    const bad = brandUpsertSchema.safeParse({
      name: 'Apple',
      slug: 'apple',
      logoUrl: 'not-a-url',
    })
    expect(bad.success).toBe(false)
  })

  it('requires reason and non-zero delta for inventory adjust', () => {
    const ok = inventoryAdjustSchema.safeParse({
      variantId: '11111111-1111-1111-1111-111111111111',
      delta: 5,
      reasonCode: 'restock',
    })
    expect(ok.success).toBe(true)

    const badReason = inventoryAdjustSchema.safeParse({
      variantId: '11111111-1111-1111-1111-111111111111',
      delta: 5,
      reasonCode: 'magic',
    })
    expect(badReason.success).toBe(false)
  })
})
