import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getActiveHomepageSections,
  getBannerSlot,
  getHomepageCollection,
  getNavigationTree,
} from '@/lib/content/queries'

/**
 * Thenable query-builder mock keyed by table name.
 *
 * Every chained method returns the builder, and awaiting the builder resolves to
 * the response registered for the table it came from. Content queries touch
 * several tables in a single call, so a single shared response is not enough.
 */
type Response = { data?: unknown; error?: unknown }

function mockBuilder(response: Response) {
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'in', 'gt', 'gte', 'lte', 'contains', 'order', 'limit', 'range']
  for (const method of methods) {
    builder[method] = vi.fn(() => builder)
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(response))
  builder.then = (resolve: (value: unknown) => unknown) => resolve(response)
  return builder
}

function mockClient(responses: Record<string, Response>) {
  const from = vi.fn((table: string) => mockBuilder(responses[table] ?? { data: [], error: null }))
  return { client: { from } as never, from }
}

function sectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-0000000000c1',
    section_key: 'hero',
    section_type: 'hero',
    title: 'Hero',
    subtitle: null,
    eyebrow: null,
    config: {},
    sort_order: 10,
    ...overrides,
  }
}

function bannerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-0000000000b1',
    name: 'Hero banner',
    slot: 'home_hero',
    title: 'Title',
    subtitle: null,
    image_desktop_url: 'https://placehold.co/1600x600',
    image_mobile_url: null,
    href: '/products',
    sort_order: 10,
    ...overrides,
  }
}

function productRow(id: string, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    category_slug: 'laptop',
    brand_name: 'Acme',
    min_price: 1000,
    has_discount: false,
    available_stock: 5,
    image_url: null,
    image_alt: null,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getActiveHomepageSections', () => {
  it('maps active sections in sort order', async () => {
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({ id: 'b', section_key: 'trust', section_type: 'trust', sort_order: 20 }),
          sectionRow({ id: 'a', section_key: 'hero', section_type: 'hero', sort_order: 10 }),
        ],
        error: null,
      },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections.map((section) => section.key)).toEqual(['hero', 'trust'])
    expect(sections[0]?.collection).toBeNull()
  })

  it('breaks sort_order ties by id so the order is stable', async () => {
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({ id: 'z', section_key: 'guides', section_type: 'guides', sort_order: 10 }),
          sectionRow({ id: 'a', section_key: 'trust', section_type: 'trust', sort_order: 10 }),
        ],
        error: null,
      },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections.map((section) => section.key)).toEqual(['trust', 'guides'])
  })

  it('skips a row with an unknown section_type and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client } = mockClient({
      homepage_sections: {
        data: [sectionRow({ section_key: 'mystery', section_type: 'not_a_section' })],
        error: null,
      },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown section_type'))
  })

  it('resolves a product_collection section to product cards in curated order', async () => {
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'deals',
            section_type: 'product_collection',
            config: { collectionSlug: 'deals' },
          }),
        ],
        error: null,
      },
      homepage_collections: {
        data: [
          {
            id: 'col-1',
            slug: 'deals',
            title: 'Deals',
            subtitle: null,
            collection_type: 'manual',
            homepage_collection_items: [
              { product_id: 'p2', sort_order: 10 },
              { product_id: 'p1', sort_order: 20 },
            ],
          },
        ],
        error: null,
      },
      catalog_products: {
        data: [productRow('p1', 'First'), productRow('p2', 'Second')],
        error: null,
      },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections).toHaveLength(1)
    expect(sections[0]?.collection?.products.map((product) => product.id)).toEqual(['p2', 'p1'])
  })

  it('applies the config limit to the resolved products', async () => {
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'deals',
            section_type: 'product_collection',
            config: { collectionSlug: 'deals', limit: 1 },
          }),
        ],
        error: null,
      },
      homepage_collections: {
        data: [
          {
            id: 'col-1',
            slug: 'deals',
            title: 'Deals',
            subtitle: null,
            collection_type: 'manual',
            homepage_collection_items: [
              { product_id: 'p1', sort_order: 10 },
              { product_id: 'p2', sort_order: 20 },
            ],
          },
        ],
        error: null,
      },
      catalog_products: { data: [productRow('p1', 'First'), productRow('p2', 'Second')], error: null },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections[0]?.collection?.products.map((product) => product.id)).toEqual(['p1'])
  })

  it('drops a product_collection section whose collection resolves to nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'deals',
            section_type: 'product_collection',
            config: { collectionSlug: 'gone' },
          }),
        ],
        error: null,
      },
      homepage_collections: { data: [], error: null },
    })

    await expect(getActiveHomepageSections(client)).resolves.toEqual([])
  })

  it('drops a product_collection section whose config has no collectionSlug', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, from } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({ section_key: 'deals', section_type: 'product_collection', config: {} }),
        ],
        error: null,
      },
    })

    await expect(getActiveHomepageSections(client)).resolves.toEqual([])
    // No slug to resolve, so the collection query is never issued.
    expect(from).not.toHaveBeenCalledWith('homepage_collections')
  })

  it('costs a fixed number of round-trips no matter how many sections exist', async () => {
    const { client, from } = mockClient({
      homepage_sections: {
        data: Array.from({ length: 12 }, (_, index) =>
          sectionRow({ id: `id-${index}`, section_key: `trust-${index}`, section_type: 'trust', sort_order: index }),
        ),
        error: null,
      },
    })

    await getActiveHomepageSections(client)

    expect(from).toHaveBeenCalledTimes(1)
  })

  it('resolves two sections sharing a collection slug with one collection query', async () => {
    const collection = {
      id: 'col-1',
      slug: 'deals',
      title: 'Deals',
      subtitle: null,
      collection_type: 'manual',
      homepage_collection_items: [{ product_id: 'p1', sort_order: 10 }],
    }
    const { client, from } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            id: 'a',
            section_key: 'deals-a',
            section_type: 'product_collection',
            config: { collectionSlug: 'deals' },
            sort_order: 10,
          }),
          sectionRow({
            id: 'b',
            section_key: 'deals-b',
            section_type: 'product_collection',
            config: { collectionSlug: 'deals' },
            sort_order: 20,
          }),
        ],
        error: null,
      },
      homepage_collections: { data: [collection], error: null },
      catalog_products: { data: [productRow('p1', 'First')], error: null },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections).toHaveLength(2)
    expect(from.mock.calls.filter(([table]) => table === 'homepage_collections')).toHaveLength(1)
    expect(from).toHaveBeenCalledTimes(3)
  })

  it('resolves every tab of a deal_tabs section in config order', async () => {
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'deals',
            section_type: 'deal_tabs',
            config: {
              tabs: [
                { label: 'Giảm giá', collectionSlug: 'sale' },
                { label: 'Mới', collectionSlug: 'new' },
              ],
              limit: 8,
            },
          }),
        ],
        error: null,
      },
      homepage_collections: {
        data: [
          {
            id: 'col-2',
            slug: 'new',
            title: 'Mới',
            subtitle: null,
            collection_type: 'manual',
            filters: {},
            homepage_collection_items: [{ product_id: 'p2', sort_order: 10 }],
          },
          {
            id: 'col-1',
            slug: 'sale',
            title: 'Giảm giá',
            subtitle: null,
            collection_type: 'manual',
            filters: {},
            homepage_collection_items: [{ product_id: 'p1', sort_order: 10 }],
          },
        ],
        error: null,
      },
      catalog_products: { data: [productRow('p1', 'First'), productRow('p2', 'Second')], error: null },
    })

    const sections = await getActiveHomepageSections(client)

    // Config order wins over the order the database returned the rows in.
    expect(sections[0]?.collections.map((collection) => collection.slug)).toEqual(['sale', 'new'])
    // `collection` stays the first tab so single-collection renderers keep working.
    expect(sections[0]?.collection?.slug).toBe('sale')
  })

  it('keeps a deal_tabs section when only some tabs have products', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'deals',
            section_type: 'deal_tabs',
            config: {
              tabs: [
                { label: 'Trống', collectionSlug: 'empty' },
                { label: 'Có hàng', collectionSlug: 'sale' },
              ],
            },
          }),
        ],
        error: null,
      },
      homepage_collections: {
        data: [
          {
            id: 'col-0',
            slug: 'empty',
            title: 'Trống',
            subtitle: null,
            collection_type: 'manual',
            filters: {},
            homepage_collection_items: [],
          },
          {
            id: 'col-1',
            slug: 'sale',
            title: 'Có hàng',
            subtitle: null,
            collection_type: 'manual',
            filters: {},
            homepage_collection_items: [{ product_id: 'p1', sort_order: 10 }],
          },
        ],
        error: null,
      },
      catalog_products: { data: [productRow('p1', 'First')], error: null },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections[0]?.collections.map((collection) => collection.slug)).toEqual(['sale'])
  })

  it('drops a deal_tabs section when no tab has products', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'deals',
            section_type: 'deal_tabs',
            config: { tabs: [{ label: 'Trống', collectionSlug: 'empty' }] },
          }),
        ],
        error: null,
      },
      homepage_collections: { data: [], error: null },
    })

    await expect(getActiveHomepageSections(client)).resolves.toEqual([])
  })

  it('resolves a dynamic collection from the catalog instead of curated items', async () => {
    const { client, from } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'sale',
            section_type: 'product_collection',
            config: { collectionSlug: 'sale', limit: 2 },
          }),
        ],
        error: null,
      },
      homepage_collections: {
        data: [
          {
            id: 'col-1',
            slug: 'sale',
            title: 'Đang giảm giá',
            subtitle: null,
            collection_type: 'discounted',
            filters: { categorySlug: 'laptop' },
            // A dynamic collection ignores curated items entirely.
            homepage_collection_items: [{ product_id: 'ignored', sort_order: 10 }],
          },
        ],
        error: null,
      },
      catalog_products: {
        data: [productRow('p1', 'First'), productRow('p2', 'Second'), productRow('p3', 'Third')],
        error: null,
      },
    })

    const sections = await getActiveHomepageSections(client)

    expect(sections[0]?.collection?.type).toBe('discounted')
    expect(sections[0]?.collection?.products.map((product) => product.id)).toEqual(['p1', 'p2'])
    // sections + collections + one catalog query for the dynamic collection.
    expect(from).toHaveBeenCalledTimes(3)
  })

  it('degrades a dynamic collection to empty when its catalog query fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client } = mockClient({
      homepage_sections: {
        data: [
          sectionRow({
            section_key: 'sale',
            section_type: 'product_collection',
            config: { collectionSlug: 'sale' },
          }),
        ],
        error: null,
      },
      homepage_collections: {
        data: [
          {
            id: 'col-1',
            slug: 'sale',
            title: 'Đang giảm giá',
            subtitle: null,
            collection_type: 'newest',
            filters: {},
            homepage_collection_items: [],
          },
        ],
        error: null,
      },
      catalog_products: { data: null, error: { message: 'boom' } },
    })

    // The section is dropped rather than rendering an empty rail, and the page lives.
    await expect(getActiveHomepageSections(client)).resolves.toEqual([])
    expect(error).toHaveBeenCalled()
  })

  it('throws a UI-safe error and logs the raw error on failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dbError = { message: 'permission denied for table homepage_sections', code: '42501' }
    const { client } = mockClient({ homepage_sections: { data: null, error: dbError } })

    await expect(getActiveHomepageSections(client)).rejects.toThrow('Failed to load homepage content')
    expect(error).toHaveBeenCalledWith(expect.any(String), dbError)
  })
})

describe('getBannerSlot', () => {
  it('returns mapped banners for a valid slot', async () => {
    const { client, from } = mockClient({
      banners: { data: [bannerRow()], error: null },
    })

    const banners = await getBannerSlot('home_hero', client)

    expect(banners).toHaveLength(1)
    expect(banners[0]?.href).toBe('/products')
    expect(from).toHaveBeenCalledWith('banners')
  })

  it('returns an empty list for an invalid slot without querying', async () => {
    const { client, from } = mockClient({})

    await expect(getBannerSlot('home_footer' as never, client)).resolves.toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('degrades to an empty list instead of throwing when the query fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dbError = { message: 'connection reset' }
    const { client } = mockClient({ banners: { data: null, error: dbError } })

    await expect(getBannerSlot('home_hero', client)).resolves.toEqual([])
    expect(error).toHaveBeenCalledWith(expect.any(String), dbError)
  })
})

describe('getHomepageCollection', () => {
  it('returns null for a slug that does not resolve', async () => {
    const { client } = mockClient({ homepage_collections: { data: [], error: null } })

    await expect(getHomepageCollection('missing', client)).resolves.toBeNull()
  })

  it('returns the collection with its products for a known slug', async () => {
    const { client } = mockClient({
      homepage_collections: {
        data: [
          {
            id: 'col-1',
            slug: 'deals',
            title: 'Deals',
            subtitle: 'Hot',
            collection_type: 'featured',
            homepage_collection_items: [{ product_id: 'p1', sort_order: 10 }],
          },
        ],
        error: null,
      },
      catalog_products: { data: [productRow('p1', 'First')], error: null },
    })

    const collection = await getHomepageCollection('deals', client)

    expect(collection?.type).toBe('featured')
    expect(collection?.products.map((product) => product.id)).toEqual(['p1'])
  })
})

describe('getNavigationTree', () => {
  it('builds a nested tree and keeps category items backed by an active category', async () => {
    const { client } = mockClient({
      navigation_items: {
        data: [
          {
            id: 'n1',
            parent_id: null,
            label: 'Laptop',
            href: '/products?category=laptop',
            item_type: 'category',
            icon_key: 'laptop',
            image_url: null,
            metadata: { categorySlug: 'laptop' },
            sort_order: 10,
            open_in_new_tab: false,
          },
          {
            id: 'n2',
            parent_id: 'n1',
            label: 'Học tập',
            href: '/products?category=laptop&useCase=hoc-tap',
            item_type: 'link',
            icon_key: null,
            image_url: null,
            metadata: {},
            sort_order: 10,
            open_in_new_tab: false,
          },
        ],
        error: null,
      },
      categories: { data: [{ slug: 'laptop' }], error: null },
    })

    const tree = await getNavigationTree(client)

    expect(tree).toHaveLength(1)
    expect(tree[0]?.children.map((child) => child.label)).toEqual(['Học tập'])
  })

  it('drops a category item whose category is no longer active', async () => {
    const { client } = mockClient({
      navigation_items: {
        data: [
          {
            id: 'n1',
            parent_id: null,
            label: 'Gone',
            href: '/products?category=gone',
            item_type: 'category',
            icon_key: null,
            image_url: null,
            metadata: { categorySlug: 'gone' },
            sort_order: 10,
            open_in_new_tab: false,
          },
        ],
        error: null,
      },
      categories: { data: [{ slug: 'laptop' }], error: null },
    })

    await expect(getNavigationTree(client)).resolves.toEqual([])
  })

  it('returns an empty tree and logs when the navigation query fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dbError = { message: 'relation "navigation_items" does not exist' }
    const { client } = mockClient({
      navigation_items: { data: null, error: dbError },
      categories: { data: [], error: null },
    })

    await expect(getNavigationTree(client)).resolves.toEqual([])
    expect(error).toHaveBeenCalledWith(expect.any(String), dbError)
  })
})
