import type { CouponInput } from '@/lib/commerce/types'

function assertIntegerVnd(value: number, name: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer VND amount`)
  }
}

export function calculateDiscount(subtotal: number, coupon: CouponInput): number {
  assertIntegerVnd(subtotal, 'subtotal')
  assertIntegerVnd(coupon.value, 'coupon.value')
  if (coupon.maximum !== null) {
    assertIntegerVnd(coupon.maximum, 'coupon.maximum')
  }
  if (coupon.type === 'percentage' && coupon.value > 100) {
    throw new RangeError('percentage discount cannot exceed 100')
  }

  const calculated =
    coupon.type === 'percentage' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value
  const capped = coupon.maximum === null ? calculated : Math.min(calculated, coupon.maximum)

  return Math.min(capped, subtotal)
}
