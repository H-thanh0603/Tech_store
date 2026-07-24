// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OrderStatus } from '@/components/commerce/order-status'

describe('OrderStatus', () => {
  it('renders stable status label and timeline', () => {
    render(<OrderStatus status="packing" paymentStatus="paid" />)
    expect(screen.getByRole('heading', { name: 'Đang đóng gói' })).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })
})
