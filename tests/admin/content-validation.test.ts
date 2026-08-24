import { describe, expect, it } from 'vitest'

import {
  bannerUpsertSchema,
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
