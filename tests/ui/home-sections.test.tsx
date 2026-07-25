// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

import { HomePageView } from '@/components/home/home-page'
import { CategoryGridSection } from '@/components/home/sections/category-grid'
import { DealTabsSection } from '@/components/home/sections/deal-tabs'
import { HeroCommerceSection } from '@/components/home/sections/hero-commerce'
import { MemberBlockSection } from '@/components/home/sections/member-block'
import type { HomeSectionContext } from '@/components/home/sections/types'
import { buildHeaderNav, navigationFallback } from '@/lib/content/nav-view'
import { saveProfile } from '@/lib/customer/profile'
import type { Banner, HomepageCollection, HomepageSection, SectionType } from '@/lib/content/types'

function product(id: string, name: string, categorySlug = 'laptop') {
  return {
    id,
    name,
    slug: id,
    categorySlug,
    brandName: 'Acme',
    minPrice: 19_990_000,
    hasDiscount: false,
    availableStock: 3,
    inStock: true,
    imageUrl: null,
    imageAlt: null,
  }
}

function collection(slug: string, title: string, products = [product('p1', 'Laptop A')]): HomepageCollection {
  return { id: `col-${slug}`, slug, title, subtitle: null, type: 'manual', products }
}

function section(type: SectionType, overrides: Partial<HomepageSection> = {}): HomepageSection {
  return {
    id: `sec-${type}`,
    key: type,
    type,
    title: 'Tiêu đề',
    subtitle: 'Mô tả',
    eyebrow: 'Eyebrow',
    sortOrder: 10,
    config: {},
    collection: null,
    collections: [],
    ...overrides,
  }
}

function banner(id: string, title: string, slot: Banner['slot'] = 'home_hero'): Banner {
  return {
    id,
    name: title,
    slot,
    title,
    subtitle: 'Phụ đề',
    imageDesktopUrl: null,
    imageMobileUrl: null,
    href: '/products',
    sortOrder: 10,
  }
}

const nav = buildHeaderNav(navigationFallback(), [{ name: 'Apple', slug: 'apple' }])

function context(overrides: Partial<HomeSectionContext> = {}): HomeSectionContext {
  return {
    products: [product('p1', 'Laptop A')],
    total: 42,
    flashOffers: [],
    navEntries: nav.entries,
    brands: [{ name: 'Apple', slug: 'apple' }],
    categories: [
      { name: 'Laptop', slug: 'laptop' },
      { name: 'Điện thoại', slug: 'dien-thoai' },
    ],
    bannersBySlot: {},
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('HeroCommerceSection', () => {
  it('uses the banner copy and renders the category rail', () => {
    render(
      <HeroCommerceSection
        section={section('hero', { config: { bannerSlot: 'home_hero', showStats: true } })}
        context={context({ bannersBySlot: { home_hero: [banner('b1', 'Ưu đãi laptop')] } })}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Ưu đãi laptop' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /danh mục nổi bật/i })).toBeInTheDocument()
    // showStats surfaces the real product count, not a made-up number.
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('falls back to the section title when no banner is scheduled', () => {
    render(<HeroCommerceSection section={section('hero')} context={context()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Tiêu đề' })).toBeInTheDocument()
  })

  it('renders side cards from the promo slot', () => {
    render(
      <HeroCommerceSection
        section={section('hero', { config: { sideBannerSlot: 'home_promo_grid', sideLimit: 2 } })}
        context={context({
          bannersBySlot: {
            home_promo_grid: [
              banner('s1', 'Ưu đãi phụ kiện tuần này', 'home_promo_grid'),
              banner('s2', 'Trả góp 0%', 'home_promo_grid'),
              banner('s3', 'Vượt quá sideLimit', 'home_promo_grid'),
            ],
          },
        })}
      />,
    )

    expect(screen.getByText('Ưu đãi phụ kiện tuần này')).toBeInTheDocument()
    expect(screen.getByText('Trả góp 0%')).toBeInTheDocument()
    expect(screen.queryByText('Vượt quá sideLimit')).not.toBeInTheDocument()
  })
})

describe('CategoryGridSection', () => {
  it('links every live category to its catalog filter', () => {
    render(<CategoryGridSection section={section('category_grid')} context={context()} />)

    expect(screen.getByRole('link', { name: 'Laptop' })).toHaveAttribute(
      'href',
      '/products?category=laptop',
    )
    expect(screen.getByRole('link', { name: 'Điện thoại' })).toHaveAttribute(
      'href',
      '/products?category=dien-thoai',
    )
  })

  it('renders nothing when the catalog has no categories', () => {
    const { container } = render(
      <CategoryGridSection section={section('category_grid')} context={context({ categories: [] })} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})

describe('DealTabsSection', () => {
  const collections = [
    collection('sale', 'Đang giảm giá', [
      product('p1', 'Laptop A', 'laptop'),
      product('p2', 'Điện thoại B', 'dien-thoai'),
    ]),
    collection('new', 'Hàng mới', [product('p3', 'Laptop C', 'laptop')]),
  ]

  const dealSection = section('deal_tabs', {
    collections,
    collection: collections[0],
    config: {
      tabs: [
        { label: 'Deal', collectionSlug: 'sale' },
        { label: 'Mới', collectionSlug: 'new' },
      ],
    },
  })

  it('renders one tab per collection with the configured labels', () => {
    render(<DealTabsSection section={dealSection} context={context()} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Deal', 'Mới'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
  })

  it('switches the panel content on click', async () => {
    const user = userEvent.setup()
    render(<DealTabsSection section={dealSection} context={context()} />)

    expect(screen.getByText('Laptop A')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Mới' }))

    expect(screen.getByText('Laptop C')).toBeInTheDocument()
    expect(screen.queryByText('Laptop A')).not.toBeInTheDocument()
  })

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<DealTabsSection section={dealSection} context={context()} />)

    const first = screen.getByRole('tab', { name: 'Deal' })
    first.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Mới' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Mới' })).toHaveFocus()
  })

  it('filters the loaded products by category without navigating', async () => {
    const user = userEvent.setup()
    render(<DealTabsSection section={dealSection} context={context()} />)

    // Counts come from the products actually on screen.
    await user.click(screen.getByRole('button', { name: 'Dien thoai (1)' }))

    expect(screen.getByText('Điện thoại B')).toBeInTheDocument()
    expect(screen.queryByText('Laptop A')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /xem tất cả sản phẩm trong danh mục này/i }),
    ).toHaveAttribute('href', '/products?category=dien-thoai')
  })

  it('renders nothing when the section has no collections', () => {
    const { container } = render(
      <DealTabsSection section={section('deal_tabs')} context={context()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})

describe('MemberBlockSection', () => {
  it('invites a new visitor to set up their details', () => {
    render(<MemberBlockSection section={section('member_block')} context={context()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Tiêu đề' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thiết lập thông tin' })).toBeInTheDocument()
    expect(screen.getByText('Chưa chọn')).toBeInTheDocument()
  })

  it('greets a returning visitor and shows their saved region', () => {
    saveProfile({ fullName: 'Lan', city: 'Hà Nội' })

    render(<MemberBlockSection section={section('member_block')} context={context()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Chào Lan' })).toBeInTheDocument()
    expect(screen.getByText('Hà Nội')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mở tài khoản' })).toBeInTheDocument()
  })

  it('never advertises loyalty points or vouchers the product does not have', () => {
    render(<MemberBlockSection section={section('member_block')} context={context()} />)

    expect(screen.queryByText(/điểm thưởng/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/voucher/i)).not.toBeInTheDocument()
  })
})

describe('HomePageView', () => {
  it('renders sections in the order the database returned them', () => {
    const sections = [
      section('category_grid', { id: 's1', sortOrder: 10 }),
      section('trust', { id: 's2', sortOrder: 20, title: 'Cam kết' }),
    ]

    render(<HomePageView sections={sections} context={context()} />)

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.indexOf('Tiêu đề')).toBeLessThan(headings.indexOf('Cam kết'))
  })

  it('shows an explicit empty state when no section is published', () => {
    render(<HomePageView sections={[]} context={context()} />)

    expect(screen.getByText('Trang chủ chưa có nội dung')).toBeInTheDocument()
  })
})

describe('section registry', () => {
  it('has a renderer for every section type', async () => {
    const { SECTION_RENDERER_KEYS } = await import('@/components/home/sections')
    const { SECTION_TYPES } = await import('@/lib/content/types')

    expect([...SECTION_RENDERER_KEYS].sort()).toEqual([...SECTION_TYPES].sort())
  })
})
