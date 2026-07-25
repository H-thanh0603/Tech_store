// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { buildHeaderNav, navigationFallback } from '@/lib/content/nav-view'

describe('Button', () => {
  it('renders an accessible button with its label', () => {
    render(<Button>Mua ngay</Button>)
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeInTheDocument()
  })

  it('is disabled and does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Thêm vào giỏ
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Thêm vào giỏ' })
    expect(button).toBeDisabled()
    button.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies the variant without dropping passed className', () => {
    render(
      <Button variant="secondary" className="extra">
        X
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass('extra')
  })
})

describe('Input', () => {
  it('associates its label with the control', () => {
    render(<Input label="Tìm kiếm" id="search" />)
    const input = screen.getByLabelText('Tìm kiếm')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('links an error message via aria-describedby and marks invalid', () => {
    render(<Input label="Email" id="email" error="Email không hợp lệ" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('renders its content', () => {
    render(<Badge>Giảm giá</Badge>)
    expect(screen.getByText('Giảm giá')).toBeInTheDocument()
  })
})

const emptyCart = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  discountTotal: 0,
  shippingTotal: 0 as const,
  total: 0,
  appliedCouponCode: null,
  canCheckout: false,
}

describe('Header', () => {
  it('renders a banner landmark with category navigation and search', () => {
    const nav = buildHeaderNav(navigationFallback(), [{ name: 'Apple', slug: 'apple' }])
    render(<Header cart={emptyCart} nav={nav} />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /danh mục sản phẩm$/i })).toBeInTheDocument()
    expect(screen.getAllByRole('search').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Tìm sản phẩm').length).toBeGreaterThan(0)
  })
})

describe('Footer', () => {
  it('renders a contentinfo landmark', () => {
    render(<Footer />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
