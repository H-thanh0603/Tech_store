import { describe, expect, it } from 'vitest'

import {
  allowedNextOrderStatuses,
  canMarkPaymentPaid,
  canTransitionOrderStatus,
  isTerminalOrderStatus,
} from '@/lib/admin/status-rules'

describe('admin order status rules', () => {
  it('allows the expected pending transitions', () => {
    expect(canTransitionOrderStatus('pending', 'confirmed')).toBe(true)
    expect(canTransitionOrderStatus('pending', 'cancelled')).toBe(true)
    expect(canTransitionOrderStatus('pending', 'shipping')).toBe(false)
  })

  it('blocks terminal self-transitions', () => {
    expect(canTransitionOrderStatus('completed', 'shipping')).toBe(false)
    expect(isTerminalOrderStatus('completed')).toBe(true)
    expect(allowedNextOrderStatuses('shipping')).toEqual(['completed'])
  })

  it('only allows paid from pending payment', () => {
    expect(canMarkPaymentPaid('pending')).toBe(true)
    expect(canMarkPaymentPaid('paid')).toBe(false)
    expect(canMarkPaymentPaid('expired')).toBe(false)
  })
})
