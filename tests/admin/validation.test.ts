import { describe, expect, it } from 'vitest'

import {
  createProductSchema,
  parseAttributesJson,
  slugifyName,
  variantUpsertSchema,
} from '@/lib/admin/validation'

describe('admin validation', () => {
  it('slugifies Vietnamese product names', () => {
    expect(slugifyName('Điện thoại Samsung')).toBe('dien-thoai-samsung')
  })

  it('accepts a valid create product payload', () => {
    const result = createProductSchema.safeParse({
      name: 'Laptop Test',
      slug: 'laptop-test',
      description: '',
      categoryId: '10000000-0000-0000-0000-000000000001',
      brandId: '',
      sku: 'LT-TEST-01',
      regularPrice: 15000000,
      salePrice: '',
      quantity: 5,
      lowStockThreshold: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects sale price above regular price', () => {
    const result = variantUpsertSchema.safeParse({
      sku: 'LT-TEST-01',
      regularPrice: 100,
      salePrice: 200,
      quantity: 1,
      lowStockThreshold: 1,
    })
    expect(result.success).toBe(false)
  })

  it('parses attribute JSON objects only', () => {
    expect(parseAttributesJson('{"color":"đen","ram":"16GB"}')).toEqual({
      color: 'đen',
      ram: '16GB',
    })
    expect(() => parseAttributesJson('[]')).toThrow()
  })
})
