import { describe, expect, it } from 'vitest'

import {
  calculateAov,
  clampRangeDays,
  isRevenueEligibleStatus,
  percentChange,
} from '@/lib/admin/dashboard-math'

describe('dashboard math', () => {
  it('excludes cancelled and expired from revenue eligibility', () => {
    expect(isRevenueEligibleStatus('completed')).toBe(true)
    expect(isRevenueEligibleStatus('confirmed')).toBe(true)
    expect(isRevenueEligibleStatus('cancelled')).toBe(false)
    expect(isRevenueEligibleStatus('expired')).toBe(false)
  })

  it('calculates AOV and avoids divide by zero', () => {
    expect(calculateAov(1_000_000, 4)).toBe(250_000)
    expect(calculateAov(1_000_000, 0)).toBe(0)
    expect(calculateAov(NaN, 2)).toBe(0)
  })

  it('returns null percent change when previous is zero', () => {
    expect(percentChange(100, 50)).toBe(100)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(10, 0)).toBeNull()
  })

  it('clamps chart range to 7/30/90', () => {
    expect(clampRangeDays(3)).toBe(7)
    expect(clampRangeDays(7)).toBe(7)
    expect(clampRangeDays(20)).toBe(30)
    expect(clampRangeDays(90)).toBe(90)
    expect(clampRangeDays(120)).toBe(90)
  })
})
