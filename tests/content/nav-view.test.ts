import { describe, expect, it } from 'vitest'

import {
  buildHeaderNav,
  navigationFallback,
  USE_CASE_FILTERS,
  type FacetOption,
} from '@/lib/content/nav-view'
import type { NavNode } from '@/lib/content/types'

function node(partial: Partial<NavNode> & { id: string; label: string }): NavNode {
  return {
    href: null,
    type: 'category',
    iconKey: null,
    imageUrl: null,
    openInNewTab: false,
    metadata: {},
    children: [],
    ...partial,
  }
}

const brands: FacetOption[] = [
  { name: 'Apple', slug: 'apple' },
  { name: 'Samsung', slug: 'samsung' },
]

describe('buildHeaderNav', () => {
  it('keeps a childless entry as a plain link without a panel', () => {
    const view = buildHeaderNav(
      [node({ id: 'n1', label: 'Tra cứu đơn', href: '/track-order', type: 'link' })],
      brands,
    )

    expect(view.entries).toHaveLength(1)
    expect(view.entries[0].panel).toBeNull()
    expect(view.entries[0].href).toBe('/track-order')
  })

  it('builds a panel with groups, brands, needs and price bands', () => {
    const view = buildHeaderNav(
      [
        node({
          id: 'n1',
          label: 'Laptop',
          href: '/products?category=laptop',
          iconKey: 'laptop',
          metadata: { categorySlug: 'laptop' },
          children: [
            node({ id: 'c1', label: 'Học tập', href: '/products?category=laptop&useCase=hoc-tap', type: 'link' }),
          ],
        }),
      ],
      brands,
    )

    const panel = view.entries[0].panel
    expect(panel).not.toBeNull()
    // First group is always the "all" shortcut, then the CMS children.
    expect(panel?.groups[0].links[0].href).toBe('/products?category=laptop')
    expect(panel?.groups[1].links.map((link) => link.label)).toEqual(['Học tập'])
    expect(panel?.brands.map((link) => link.href)).toEqual([
      '/products?brand=apple',
      '/products?brand=samsung',
    ])
    expect(panel?.needs).toHaveLength(USE_CASE_FILTERS.length)
    expect(panel?.priceBands).toHaveLength(5)
  })

  it('scopes need and price links to the entry category but not brand links', () => {
    const view = buildHeaderNav(
      [
        node({
          id: 'n1',
          label: 'Điện thoại',
          href: '/products?category=dien-thoai',
          metadata: { categorySlug: 'dien-thoai' },
          children: [node({ id: 'c1', label: 'Chụp ảnh', href: '/products?category=dien-thoai', type: 'link' })],
        }),
      ],
      brands,
    )
    const panel = view.entries[0].panel!

    expect(panel.needs[0].href).toContain('category=dien-thoai')
    expect(panel.needs[0].href).toContain('useCase=hoc-tap')
    expect(panel.priceBands[0].href).toBe('/products?category=dien-thoai&maxPrice=5000000')
    expect(panel.priceBands[4].href).toBe('/products?category=dien-thoai&minPrice=30000000')
    expect(panel.brands[0].href).not.toContain('category=')
  })

  it('promotes a third level into its own titled column', () => {
    const view = buildHeaderNav(
      [
        node({
          id: 'n1',
          label: 'PC',
          href: '/products?category=pc',
          metadata: { categorySlug: 'pc' },
          children: [
            node({
              id: 'c1',
              label: 'Màn hình',
              children: [
                node({ id: 'g1', label: 'Màn gaming', href: '/products?category=man-hinh', type: 'link' }),
              ],
            }),
          ],
        }),
      ],
      brands,
    )

    const titles = view.entries[0].panel!.groups.map((group) => group.title)
    expect(titles).toContain('Màn hình')
  })

  it('drops children that have no href', () => {
    const view = buildHeaderNav(
      [
        node({
          id: 'n1',
          label: 'Laptop',
          href: '/products?category=laptop',
          children: [node({ id: 'c1', label: 'Không có link', href: null, type: 'link' })],
        }),
      ],
      brands,
    )

    const groups = view.entries[0].panel!.groups
    expect(groups.every((group) => group.links.every((link) => Boolean(link.href)))).toBe(true)
    expect(groups.flatMap((group) => group.links.map((l) => l.label))).not.toContain('Không có link')
  })

  it('does not repeat an href across the panel groups', () => {
    const view = buildHeaderNav(
      [
        node({
          id: 'n1',
          label: 'Laptop',
          href: '/products?category=laptop',
          children: [
            // Same target as the generated "all" shortcut.
            node({ id: 'c1', label: 'Tất cả laptop', href: '/products?category=laptop', type: 'link' }),
            node({ id: 'c2', label: 'Học tập', href: '/products?category=laptop&useCase=hoc-tap', type: 'link' }),
          ],
        }),
      ],
      brands,
    )

    const hrefs = view.entries[0].panel!.groups.flatMap((group) =>
      group.links.map((link) => link.href),
    )
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('caps the brand column so the panel stays scannable', () => {    const many: FacetOption[] = Array.from({ length: 20 }, (_, i) => ({
      name: `Brand ${i}`,
      slug: `brand-${i}`,
    }))
    const view = buildHeaderNav(
      [
        node({
          id: 'n1',
          label: 'Laptop',
          href: '/products?category=laptop',
          children: [node({ id: 'c1', label: 'Học tập', href: '/products', type: 'link' })],
        }),
      ],
      many,
    )

    expect(view.entries[0].panel!.brands).toHaveLength(8)
  })

  it('exposes quick links for the menu surface', () => {
    const view = buildHeaderNav([], brands)
    expect(view.quickLinks.length).toBeGreaterThan(0)
    expect(view.quickLinks.every((link) => link.href.startsWith('/'))).toBe(true)
  })
})

describe('navigationFallback', () => {
  it('produces a usable tree when the CMS table is empty', () => {
    const fallback = navigationFallback()
    expect(fallback.length).toBeGreaterThan(0)
    expect(fallback.every((item) => Boolean(item.href))).toBe(true)

    const view = buildHeaderNav(fallback, brands)
    const withPanel = view.entries.filter((entry) => entry.panel !== null)
    expect(withPanel.length).toBeGreaterThan(0)
  })
})
