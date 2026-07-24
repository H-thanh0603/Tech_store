// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProductCard } from '@/components/commerce/product-card'
import type { ProductCardData } from '@/lib/catalog/types'

function makeProduct(overrides: Partial<ProductCardData> = {}): ProductCardData {
  return {
    id: 'p1',
    name: 'MacBook Air M3',
    slug: 'macbook-air-m3',
    categorySlug: 'laptop',
    brandName: 'Apple',
    minPrice: 27990000,
    hasDiscount: false,
    availableStock: 18,
    inStock: true,
    imageUrl: 'https://placehold.co/800x800',
    imageAlt: 'MacBook Air M3',
    ...overrides,
  }
}

describe('ProductCard', () => {
  it('links to the product detail page by slug', () => {
    render(<ProductCard product={makeProduct()} />)
    const link = screen.getByRole('link', { name: /macbook air m3/i })
    expect(link).toHaveAttribute('href', '/products/macbook-air-m3')
  })

  it('renders the formatted price', () => {
    render(<ProductCard product={makeProduct({ minPrice: 27990000 })} />)
    // vi-VN currency formatting inserts non-breaking separators; match digits.
    expect(screen.getByText(/27\.990\.000/)).toBeInTheDocument()
  })

  it('shows a discount badge only when discounted', () => {
    const { rerender } = render(<ProductCard product={makeProduct({ hasDiscount: true })} />)
    expect(screen.getByText('Giảm giá')).toBeInTheDocument()

    rerender(<ProductCard product={makeProduct({ hasDiscount: false })} />)
    expect(screen.queryByText('Giảm giá')).not.toBeInTheDocument()
  })

  it('shows an out-of-stock badge when stock is depleted', () => {
    render(<ProductCard product={makeProduct({ inStock: false, availableStock: 0 })} />)
    expect(screen.getByText('Hết hàng')).toBeInTheDocument()
  })

  it('falls back to a placeholder when the image is missing', () => {
    render(<ProductCard product={makeProduct({ imageUrl: null, imageAlt: null })} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Chưa có ảnh')).toBeInTheDocument()
  })

  it('uses the product name as image alt when alt text is absent', () => {
    render(<ProductCard product={makeProduct({ imageAlt: null })} />)
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'MacBook Air M3')
  })

  it('renders long product names without throwing', () => {
    const longName =
      'Samsung Galaxy S24 Ultra 512GB Titan Đen Phiên Bản Giới Hạn Cao Cấp Dành Cho Người Dùng Chuyên Nghiệp'
    render(<ProductCard product={makeProduct({ name: longName, slug: 'long' })} />)
    expect(screen.getByRole('link', { name: new RegExp(longName.slice(0, 20), 'i') })).toBeInTheDocument()
  })
})
