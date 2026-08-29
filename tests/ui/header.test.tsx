// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

import { SearchSuggest } from '@/components/commerce/search-suggest'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Header } from '@/components/layout/header'
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer'
import { buildHeaderNav, navigationFallback } from '@/lib/content/nav-view'
import { openSearch } from '@/lib/customer/search-events'

const nav = buildHeaderNav(navigationFallback(), [
  { name: 'Apple', slug: 'apple' },
  { name: 'ASUS', slug: 'asus' },
])

beforeEach(() => {
  push.mockReset()
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Header', () => {
  it('renders the three tiers: commitments, search and the category bar', () => {
    render(<Header nav={nav} />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getAllByRole('search').length).toBeGreaterThan(0)
    expect(screen.getByRole('navigation', { name: /danh mục sản phẩm$/i })).toBeInTheDocument()
    expect(screen.getAllByText('Sản phẩm chính hãng').length).toBeGreaterThan(0)
  })

  it('opens a mega panel with brand, need and price columns from a category trigger', async () => {
    const user = userEvent.setup()
    render(<Header nav={nav} />)

    const bar = screen.getByRole('navigation', { name: /danh mục sản phẩm$/i })
    const trigger = within(bar).getByRole('button', { name: /^Laptop/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Thương hiệu')).toBeInTheDocument()
    expect(screen.getByText('Theo nhu cầu')).toBeInTheDocument()
    expect(screen.getByText('Mức giá')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apple' })).toHaveAttribute(
      'href',
      '/products?brand=apple',
    )
  })

  it('closes the open panel on Escape', async () => {
    const user = userEvent.setup()
    render(<Header nav={nav} />)

    const bar = screen.getByRole('navigation', { name: /danh mục sản phẩm$/i })
    const trigger = within(bar).getByRole('button', { name: /^Laptop/ })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the mobile category drawer as a modal dialog', async () => {
    const user = userEvent.setup()
    render(<Header nav={nav} />)

    await user.click(screen.getByRole('button', { name: 'Mở menu danh mục' }))

    const dialog = screen.getByRole('dialog', { name: /danh mục và điều hướng/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})

describe('MobileNavDrawer', () => {
  it('expands a category into its child links', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <MobileNavDrawer open entries={nav.entries} quickLinks={nav.quickLinks} onClose={onClose} />,
    )

    const expander = screen.getByRole('button', { name: /mở rộng laptop/i })
    await user.click(expander)

    expect(expander).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Sinh viên' })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <MobileNavDrawer open entries={nav.entries} quickLinks={nav.quickLinks} onClose={onClose} />,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('BottomNav', () => {
  it('renders five destinations and marks the current one', () => {
    render(<BottomNav />)

    const bar = screen.getByRole('navigation', { name: /điều hướng chính/i })
    expect(within(bar).getAllByRole('listitem')).toHaveLength(5)
    expect(within(bar).getByRole('link', { name: /trang chủ/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('asks the header search to open instead of navigating', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    window.addEventListener('techstore:open-search', onOpen)
    render(<BottomNav />)

    await user.click(screen.getByRole('button', { name: /tìm kiếm/i }))

    expect(onOpen).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    window.removeEventListener('techstore:open-search', onOpen)
  })
})

describe('SearchSuggest overlay', () => {
  it('shows popular keywords and category shortcuts before typing', async () => {
    const user = userEvent.setup()
    render(
      <SearchSuggest categories={[{ label: 'Laptop', href: '/products?category=laptop' }]} />,
    )

    await user.click(screen.getByLabelText('Tìm sản phẩm'))

    expect(screen.getByRole('region', { name: /từ khóa phổ biến/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /laptop/i })).toHaveAttribute(
      'href',
      '/products?category=laptop',
    )
  })

  it('records a submitted term as a recent search and offers to clear it', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<SearchSuggest />)

    const input = screen.getByLabelText('Tìm sản phẩm')
    await user.type(input, 'macbook{Enter}')

    expect(push).toHaveBeenCalledWith('/products?q=macbook')
    unmount()

    render(<SearchSuggest />)
    await user.click(screen.getByLabelText('Tìm sản phẩm'))
    expect(screen.getByRole('region', { name: /tìm kiếm gần đây/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'macbook' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(screen.queryByRole('region', { name: /tìm kiếm gần đây/i })).not.toBeInTheDocument()
  })

  it('renders an empty state when the API finds nothing', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ products: [], empty: true }) })),
    )
    render(<SearchSuggest />)

    await user.type(screen.getByLabelText('Tìm sản phẩm'), 'zzzz')

    await waitFor(() => expect(screen.getByText('Không có kết quả')).toBeInTheDocument())
  })

  it('is opened by the global search event when visible', async () => {
    render(<SearchSuggest />)

    const input = screen.getByLabelText('Tìm sản phẩm')
    Object.defineProperty(input, 'offsetParent', { value: document.body, configurable: true })
    openSearch()

    await waitFor(() => expect(input).toHaveFocus())
  })
})
