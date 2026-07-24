import { describe, expect, it } from 'vitest'

import {
  canAddToCart,
  resolveSelectedVariant,
  variantLabel,
} from '@/lib/catalog/variant-selection'
import type { ProductVariantData } from '@/lib/catalog/types'

function variant(overrides: Partial<ProductVariantData> = {}): ProductVariantData {
  return {
    id: 'v1',
    sku: 'SKU-1',
    attributes: { ram: '8GB', storage: '256GB' },
    regularPrice: 1000,
    salePrice: null,
    price: 1000,
    hasDiscount: false,
    availableStock: 5,
    inStock: true,
    ...overrides,
  }
}

describe('resolveSelectedVariant', () => {
  it('returns undefined when there are no variants', () => {
    expect(resolveSelectedVariant([], 'v1')).toBeUndefined()
  })

  it('returns the matching variant by id', () => {
    const a = variant({ id: 'a' })
    const b = variant({ id: 'b' })
    expect(resolveSelectedVariant([a, b], 'b')).toBe(b)
  })

  it('falls back to the first variant for a missing or unknown id', () => {
    const a = variant({ id: 'a' })
    const b = variant({ id: 'b' })
    expect(resolveSelectedVariant([a, b], undefined)).toBe(a)
    expect(resolveSelectedVariant([a, b], 'nope')).toBe(a)
  })
})

describe('canAddToCart', () => {
  it('is false when no variant is selected', () => {
    expect(canAddToCart(undefined)).toBe(false)
  })

  it('is false for an out-of-stock variant', () => {
    expect(canAddToCart(variant({ inStock: false, availableStock: 0 }))).toBe(false)
  })

  it('is false when stock is zero even if flagged in stock', () => {
    expect(canAddToCart(variant({ inStock: true, availableStock: 0 }))).toBe(false)
  })

  it('is true for an in-stock variant', () => {
    expect(canAddToCart(variant({ inStock: true, availableStock: 3 }))).toBe(true)
  })
})

describe('variantLabel', () => {
  it('joins attribute values', () => {
    expect(variantLabel(variant({ attributes: { color: 'Bạc', ram: '8GB' } }))).toBe('Bạc · 8GB')
  })

  it('falls back to the SKU when there are no attributes', () => {
    expect(variantLabel(variant({ attributes: {}, sku: 'TN-PRE-001' }))).toBe('TN-PRE-001')
  })
})
