// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

process.env.VIETQR_BANK_ID = '970422'
process.env.VIETQR_ACCOUNT_NO = '123456789'
process.env.VIETQR_ACCOUNT_NAME = 'TECHSTORE'

import { CheckoutForm } from '@/components/commerce/checkout-form'
import { PaymentSummary } from '@/components/commerce/payment-summary'
import type { CartData, OrderConfirmationData } from '@/lib/commerce/types'

const cart: CartData = {
  items: [],
  itemCount: 1,
  subtotal: 1000000,
  discountTotal: 0,
  shippingTotal: 0,
  total: 1000000,
  appliedCouponCode: null,
  canCheckout: true,
}

const transferOrder: OrderConfirmationData = {
  orderCode: 'TS-20260724-0001',
  paymentMethod: 'bank_transfer',
  paymentStatus: 'pending',
  orderStatus: 'awaiting_payment',
  subtotal: 1000000,
  discountTotal: 0,
  shippingTotal: 0,
  total: 1000000,
  transferExpiresAt: '2026-07-25T12:00:00.000Z',
  items: [],
}

describe('CheckoutForm', () => {
  it('renders all required checkout fields with labels', () => {
    render(<CheckoutForm cart={cart} initialState={{ ok: true }} />)
    expect(screen.getByLabelText(/họ và tên/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/số điện thoại/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tỉnh\/thành phố/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /cod/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /chuyển khoản/i })).toBeInTheDocument()
  })
})

describe('PaymentSummary', () => {
  it('renders bank transfer QR and text fallback', () => {
    render(<PaymentSummary order={transferOrder} />)
    expect(screen.getByRole('img', { name: /mã qr/i })).toBeInTheDocument()
    expect(screen.getByText(/số tài khoản/i)).toBeInTheDocument()
    expect(screen.getByText('TS-20260724-0001')).toBeInTheDocument()
  })

  it('renders expired transfer state without payment CTA', () => {
    render(
      <PaymentSummary
        order={{ ...transferOrder, paymentStatus: 'expired', orderStatus: 'expired' }}
      />,
    )
    expect(screen.getByText(/đã hết hạn/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /thanh toán/i })).not.toBeInTheDocument()
  })
})
