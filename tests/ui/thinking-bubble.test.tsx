// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  detectIntent,
  ThinkingBubble,
  type ShoppingIntent,
} from '@/components/assistant/thinking-bubble'

const INTENT_FIRST_STAGE: Record<ShoppingIntent, string> = {
  default: 'Đang tìm trong catalog TechStore',
  compare: 'Đang so giá, tồn kho và khuyến mãi',
  list: 'Đang lục catalog TechStore',
  order: 'Đang tra cứu đơn hàng',
  policy: 'Đang đọc chính sách cửa hàng',
}

describe('ThinkingBubble', () => {
  it('announces itself as a live status with the first shopping stage', () => {
    render(<ThinkingBubble variant="shopping" />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Đang tìm trong catalog TechStore')
  })

  it('uses merchant copy for the ops variant', () => {
    render(<ThinkingBubble variant="merchant" />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang đọc số liệu vận hành')
  })

  it('rotates stages over time and sticks on the last one', () => {
    vi.useFakeTimers()
    try {
      render(<ThinkingBubble variant="shopping" />)
      expect(screen.getByRole('status')).toHaveTextContent('Đang tìm trong catalog')
      for (const expected of ['Đang so giá', 'Đang gói câu trả lời', 'Hơi lâu một xíu']) {
        act(() => vi.advanceTimersByTime(4500))
        expect(screen.getByRole('status')).toHaveTextContent(expected)
      }
      act(() => vi.advanceTimersByTime(45000))
      expect(screen.getByRole('status')).toHaveTextContent('Hơi lâu một xíu')
    } finally {
      vi.useRealTimers()
    }
  })

  it('picks stage copy by the sniffed intent', () => {
    for (const intent of Object.keys(INTENT_FIRST_STAGE) as ShoppingIntent[]) {
      const { unmount } = render(<ThinkingBubble variant="shopping" intent={intent} />)
      expect(screen.getByRole('status')).toHaveTextContent(INTENT_FIRST_STAGE[intent])
      unmount()
    }
  })

  it('routes user phrasing to the matching intent', () => {
    expect(detectIntent('So sánh iPhone 15 và Galaxy S24 giúp mình')).toBe('compare')
    expect(detectIntent('2 con này khác nhau gì?')).toBe('compare')
    expect(detectIntent('Liệt kê các laptop dưới 15 triệu')).toBe('list')
    expect(detectIntent('Shop có những dòng máy nào?')).toBe('list')
    expect(detectIntent('Tra cứu đơn hàng giúp mình')).toBe('order')
    expect(detectIntent('Mã đơn TSC12345')).toBe('order')
    expect(detectIntent('Chính sách đổi trả thế nào?')).toBe('policy')
    expect(detectIntent('Máy này bảo hành bao lâu?')).toBe('policy')
    expect(detectIntent('Laptop gaming tầm 25 triệu máy nào ngon?')).toBe('default')
  })
})
