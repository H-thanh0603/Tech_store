import { describe, expect, it } from 'vitest'

import { hasHumanCartConfirm } from '@/lib/assistant/cart-confirm'

describe('hasHumanCartConfirm (H2)', () => {
  it('accepts explicit cart verbs and confirmations', () => {
    expect(hasHumanCartConfirm('thêm giúp mình con iPhone 15 nhé')).toBe(true)
    expect(hasHumanCartConfirm('lấy con này')).toBe(true)
    expect(hasHumanCartConfirm('đồng ý thanh toán')).toBe(true)
    expect(hasHumanCartConfirm('OK lấy luôn')).toBe(true)
    expect(hasHumanCartConfirm('xóa món này giúp')).toBe(true)
  })

  it('rejects browsing chatter without cart intent', () => {
    expect(hasHumanCartConfirm('con này giá bao nhiêu?')).toBe(false)
    expect(hasHumanCartConfirm('so sánh giúp mình 2 con')).toBe(false)
    expect(hasHumanCartConfirm('chính sách đổi trả thế nào')).toBe(false)
    expect(hasHumanCartConfirm('')).toBe(false)
  })
})
