// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CouponForm } from '@/components/commerce/coupon-form'
import { CartPageContent } from '@/components/commerce/cart-page-content'
import type { CartData } from '@/lib/commerce/types'

const emptyCart: CartData = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  discountTotal: 0,
  shippingTotal: 0,
  total: 0,
  appliedCouponCode: null,
  canCheckout: false,
}

const cartWithPriceChange: CartData = {
  ...emptyCart,
  itemCount: 1,
  subtotal: 20_000_000,
  total: 20_000_000,
  canCheckout: false,
  items: [
    {
      id: 'f1c99840-a4c2-4bb2-918b-9d3f2dc8bb95',
      variantId: 'ba3e5dc7-7b44-44ec-88f8-9d55a3a587eb',
      productName: 'Laptop TechStore',
      productSlug: 'laptop-techstore',
      sku: 'LAPTOP-01',
      attributes: { RAM: '16GB' },
      quantity: 1,
      priceAtAdd: 18_000_000,
      currentPrice: 20_000_000,
      lineTotal: 20_000_000,
      availableStock: 4,
      priceChanged: true,
      outOfStock: false,
      imageUrl: null,
      imageAlt: null,
    },
  ],
}

describe('cart storefront', () => {
  it('renders empty cart recovery link', () => {
    render(<CartPageContent cart={emptyCart} />)

    expect(screen.getByText('Giỏ hàng đang trống')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /xem sản phẩm/i })).toHaveAttribute(
      'href',
      '/products',
    )
  })

  it('keeps checkout disabled when price changed', () => {
    render(<CartPageContent cart={cartWithPriceChange} />)

    expect(screen.getByText(/giá đã thay đổi/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /đến thanh toán/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('does not expose a dead checkout route while checkout is not implemented', () => {
    render(<CartPageContent cart={{ ...cartWithPriceChange, canCheckout: true, items: cartWithPriceChange.items.map((item) => ({ ...item, priceChanged: false })) }} />)

    expect(screen.getByRole('link', { name: /đến thanh toán/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('link', { name: /đến thanh toán/i })).not.toHaveAttribute('href')
  })

  it('renders coupon failure with a field-level message', () => {
    render(
      <CouponForm
        state={{ ok: false, code: 'COUPON_INVALID', message: 'Mã giảm giá không hợp lệ.' }}
      />,
    )

    const input = screen.getByLabelText('Mã giảm giá')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'coupon-error')
    expect(screen.getByText('Mã giảm giá không hợp lệ.')).toHaveAttribute('id', 'coupon-error')
  })
})
