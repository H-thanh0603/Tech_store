import { describe, expect, it } from 'vitest'

import {
  bannerUpsertSchema,
  flashOfferUpsertSchema,
  navigationUpsertSchema,
  parseSectionForm,
} from '@/lib/admin/content-validation'

describe('admin content validation', () => {
  it('accepts a safe banner and rejects unsafe links', () => {
    expect(
      bannerUpsertSchema.safeParse({
        name: 'Hero tháng 8',
        slot: 'home_hero',
        href: '/products',
        sortOrder: 0,
        isActive: true,
      }).success,
    ).toBe(true)

    expect(
      bannerUpsertSchema.safeParse({
        name: 'Bad',
        slot: 'home_hero',
        href: 'javascript:alert(1)',
        sortOrder: 0,
      }).success,
    ).toBe(false)
  })

  it('validates section config against its selected type', () => {
    expect(
      parseSectionForm({
        sectionKey: 'featured-phones',
        sectionType: 'product_collection',
        config: '{"collectionSlug":"featured","limit":8,"layout":"grid"}',
        sortOrder: 2,
        isActive: true,
      }).success,
    ).toBe(true)

    expect(
      parseSectionForm({
        sectionKey: 'featured-phones',
        sectionType: 'product_collection',
        config: '{}',
        sortOrder: 2,
      }).success,
    ).toBe(false)
  })

  it('requires href for links but permits a group without one', () => {
    expect(
      navigationUpsertSchema.safeParse({
        label: 'Điện thoại',
        itemType: 'link',
        href: '/products?category=dien-thoai',
        sortOrder: 0,
      }).success,
    ).toBe(true)

    expect(
      navigationUpsertSchema.safeParse({
        label: 'Sản phẩm',
        itemType: 'group',
        href: '',
        sortOrder: 0,
      }).success,
    ).toBe(true)
  })
})

describe('flash offer validation', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString()
  const later = new Date(Date.now() + 2 * 86_400_000).toISOString()

  it('accepts a live offer with a valid window', () => {
    expect(
      flashOfferUpsertSchema.safeParse({
        productId: '30000000-0000-0000-0000-000000000001',
        title: 'Deal hot',
        badge: '⚡ Flash',
        endsAt: future,
        sortOrder: 0,
        isActive: true,
      }).success,
    ).toBe(true)
  })

  it('accepts a scheduled offer and rejects end before start', () => {
    const input = {
      productId: '30000000-0000-0000-0000-000000000001',
      title: 'Deal hẹn trước',
      startsAt: later,
      endsAt: future,
      sortOrder: 0,
      isActive: true,
    }
    expect(flashOfferUpsertSchema.safeParse(input).success).toBe(false)
    expect(
      flashOfferUpsertSchema.safeParse({ ...input, startsAt: future, endsAt: later }).success,
    ).toBe(true)
  })

  it('rejects an offer that already ended on create', () => {
    expect(
      flashOfferUpsertSchema.safeParse({
        productId: '30000000-0000-0000-0000-000000000001',
        title: 'Deal hết hạn',
        endsAt: new Date(Date.now() - 3_600_000).toISOString(),
        sortOrder: 0,
        isActive: true,
      }).success,
    ).toBe(false)
  })

  it('rejects an invalid product id', () => {
    expect(
      flashOfferUpsertSchema.safeParse({
        productId: 'not-a-uuid',
        title: 'Deal',
        endsAt: future,
        sortOrder: 0,
        isActive: true,
      }).success,
    ).toBe(false)
  })
})
