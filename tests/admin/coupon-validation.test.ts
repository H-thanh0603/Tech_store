import { describe, expect, it } from 'vitest'

import { couponUpsertSchema, orderStatusSchema } from '@/lib/admin/validation'

describe('coupon and order validation (phase 5)', () => {
  it('normalizes coupon code and blocks bad percentage', () => {
    const ok = couponUpsertSchema.safeParse({
      code: ' sale 10 ',
      discountType: 'percentage',
      discountValue: 10,
      minimumOrder: 0,
      isActive: true,
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.code).toBe('SALE10')

    const bad = couponUpsertSchema.safeParse({
      code: 'BADPCT',
      discountType: 'percentage',
      discountValue: 150,
    })
    expect(bad.success).toBe(false)
  })

  it('requires reason when cancelling order', () => {
    const missing = orderStatusSchema.safeParse({
      orderCode: 'TS-1',
      orderStatus: 'cancelled',
      reason: '',
    })
    expect(missing.success).toBe(false)

    const ok = orderStatusSchema.safeParse({
      orderCode: 'TS-1',
      orderStatus: 'cancelled',
      reason: 'Khách đổi ý',
    })
    expect(ok.success).toBe(true)

    const confirm = orderStatusSchema.safeParse({
      orderCode: 'TS-1',
      orderStatus: 'confirmed',
      reason: '',
    })
    expect(confirm.success).toBe(true)
  })

  it('rejects end before start', () => {
    const bad = couponUpsertSchema.safeParse({
      code: 'TIME',
      discountType: 'fixed',
      discountValue: 10000,
      startsAt: '2026-07-20T10:00',
      endsAt: '2026-07-19T10:00',
    })
    expect(bad.success).toBe(false)
  })
})
