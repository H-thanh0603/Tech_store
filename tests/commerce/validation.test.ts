import { describe, expect, it } from 'vitest'

import {
  cartItemSchema,
  checkoutSchema,
  couponCodeSchema,
  trackingSchema,
} from '@/lib/commerce/validation'

const VALID_VARIANT = '40000000-0000-0000-0000-000000000001'

describe('cartItemSchema', () => {
  it('accepts a valid variant id and quantity', () => {
    const parsed = cartItemSchema.safeParse({ variantId: VALID_VARIANT, quantity: 2 })
    expect(parsed.success).toBe(true)
  })

  it('coerces a numeric string quantity from FormData', () => {
    const parsed = cartItemSchema.safeParse({ variantId: VALID_VARIANT, quantity: '3' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.quantity).toBe(3)
    }
  })

  it('rejects a non-uuid variant id', () => {
    expect(cartItemSchema.safeParse({ variantId: 'bad', quantity: 1 }).success).toBe(false)
  })

  it('rejects quantity below 1 and above 99', () => {
    expect(cartItemSchema.safeParse({ variantId: VALID_VARIANT, quantity: 0 }).success).toBe(false)
    expect(cartItemSchema.safeParse({ variantId: VALID_VARIANT, quantity: 100 }).success).toBe(false)
  })
})

describe('couponCodeSchema', () => {
  it('uppercases and trims a code', () => {
    const parsed = couponCodeSchema.safeParse({ code: '  welcome10 ' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.code).toBe('WELCOME10')
    }
  })

  it('rejects an empty code', () => {
    expect(couponCodeSchema.safeParse({ code: '   ' }).success).toBe(false)
  })
})

describe('checkoutSchema', () => {
  const validCheckout = {
    customerName: 'Nguyễn Văn A',
    customerPhone: '0901234567',
    customerEmail: '',
    province: 'Hà Nội',
    district: 'Cầu Giấy',
    ward: 'Dịch Vọng',
    streetAddress: '123 đường Xuân Thủy',
    note: '',
    paymentMethod: 'cod',
    idempotencyKey: '11111111-1111-1111-1111-111111111111',
  }

  it('accepts a valid Vietnamese checkout payload', () => {
    expect(checkoutSchema.safeParse(validCheckout).success).toBe(true)
  })

  it('rejects empty name, malformed phone, and unknown payment method', () => {
    expect(
      checkoutSchema.safeParse({
        ...validCheckout,
        customerName: '',
        customerPhone: '123',
        paymentMethod: 'cash',
      }).success,
    ).toBe(false)
  })

  it('accepts +84 phone format', () => {
    expect(
      checkoutSchema.safeParse({ ...validCheckout, customerPhone: '+84901234567' }).success,
    ).toBe(true)
  })

  it('rejects a landline-prefixed phone', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, customerPhone: '0201234567' }).success).toBe(
      false,
    )
  })

  it('accepts an optional valid email but rejects a malformed one', () => {
    expect(
      checkoutSchema.safeParse({ ...validCheckout, customerEmail: 'a@b.com' }).success,
    ).toBe(true)
    expect(checkoutSchema.safeParse({ ...validCheckout, customerEmail: 'bad' }).success).toBe(false)
  })

  it('requires a uuid idempotency key', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, idempotencyKey: 'x' }).success).toBe(false)
  })
})

describe('trackingSchema', () => {
  it('accepts an order code and valid phone', () => {
    expect(trackingSchema.safeParse({ orderCode: 'TS-20260724-0001', phone: '0901234567' }).success).toBe(
      true,
    )
  })

  it('rejects an empty order code', () => {
    expect(trackingSchema.safeParse({ orderCode: '', phone: '0901234567' }).success).toBe(false)
  })
})
