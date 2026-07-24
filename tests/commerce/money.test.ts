import { describe, expect, it } from 'vitest'

import { calculateDiscount } from '@/lib/commerce/money'

describe('calculateDiscount', () => {
  it('calculates capped percentage discount with integer arithmetic', () => {
    expect(calculateDiscount(100000, { type: 'percentage', value: 15, maximum: 10000 })).toBe(10000)
  })

  it('floors a percentage that does not divide evenly', () => {
    // 10% of 99999 = 9999.9 -> floored to 9999
    expect(calculateDiscount(99999, { type: 'percentage', value: 10, maximum: null })).toBe(9999)
  })

  it('applies percentage without a maximum cap when none is given', () => {
    expect(calculateDiscount(200000, { type: 'percentage', value: 10, maximum: null })).toBe(20000)
  })

  it('caps fixed discount at subtotal', () => {
    expect(calculateDiscount(50000, { type: 'fixed', value: 100000, maximum: null })).toBe(50000)
  })

  it('applies a fixed discount below subtotal directly', () => {
    expect(calculateDiscount(500000, { type: 'fixed', value: 100000, maximum: null })).toBe(100000)
  })

  it('never returns a discount greater than the subtotal for percentages', () => {
    expect(calculateDiscount(1000, { type: 'percentage', value: 100, maximum: null })).toBe(1000)
  })

  it('returns 0 for a zero subtotal', () => {
    expect(calculateDiscount(0, { type: 'percentage', value: 50, maximum: null })).toBe(0)
  })

  it('rejects non-finite or negative subtotal', () => {
    expect(() => calculateDiscount(Number.NaN, { type: 'fixed', value: 1, maximum: null })).toThrow()
    expect(() => calculateDiscount(-1, { type: 'fixed', value: 1, maximum: null })).toThrow()
  })

  it('rejects a non-integer subtotal', () => {
    expect(() => calculateDiscount(100.5, { type: 'fixed', value: 1, maximum: null })).toThrow()
  })
})
