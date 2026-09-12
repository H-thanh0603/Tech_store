import { describe, expect, it } from 'vitest'

import {
  absentTools,
  assistantConfig,
  wantsOrderGrounding,
  wantsPolicyGrounding,
} from '@/lib/assistant/config'

describe('assistant pilot config', () => {
  it('keeps cart and fulfillment switched on (full commerce-agents scope)', () => {
    expect(assistantConfig.enableCart).toBe(true)
    expect(assistantConfig.enableFulfillment).toBe(true)
    const absent = absentTools(assistantConfig)
    expect(absent.has('add_to_cart')).toBe(false)
    expect(absent.has('checkout')).toBe(false)
    expect(absent.has('get_fulfillment_options')).toBe(false)
  })

  it('keeps search, details, order tracking and policies on', () => {
    const absent = absentTools(assistantConfig)
    for (const tool of ['search_products', 'get_product_details', 'track_order', 'search_policies']) {
      expect(absent.has(tool)).toBe(false)
    }
  })

  it('detects Vietnamese policy intent', () => {
    expect(wantsPolicyGrounding('Chính sách đổi trả thế nào?')).toBe(true)
    expect(wantsPolicyGrounding('hoàn tiền mất bao lâu')).toBe(true)
    expect(wantsPolicyGrounding('laptop nào pin tốt')).toBe(false)
  })

  it('detects order intent and order codes', () => {
    expect(wantsOrderGrounding('đơn hàng của tôi tới đâu rồi')).toBe(true)
    expect(wantsOrderGrounding('TS-ABC123 giao chưa')).toBe(true)
    expect(wantsOrderGrounding('máy nào chụp ảnh đẹp')).toBe(false)
  })
})
