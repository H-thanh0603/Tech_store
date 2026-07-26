import { describe, expect, it } from 'vitest'

import {
  buildNavigationTree,
  isVisibleNow,
  mapBannerRow,
  mapSectionRow,
  reorderByIds,
  sortByOrder,
  toOrder,
  type NavigationRow,
  type SectionRow,
} from '@/lib/content/normalize'

const NOW = new Date('2026-07-26T12:00:00.000Z')

function navRow(overrides: Partial<NavigationRow> & { id: string }): NavigationRow {
  return {
    parent_id: null,
    label: `Item ${overrides.id}`,
    href: '/products',
    item_type: 'link',
    icon_key: null,
    image_url: null,
    metadata: {},
    sort_order: 0,
    open_in_new_tab: false,
    is_active: true,
    ...overrides,
  }
}

function sectionRow(overrides: Partial<SectionRow> & { id: string }): SectionRow {
  return {
    section_key: `key-${overrides.id}`,
    section_type: 'trust',
    title: null,
    subtitle: null,
    eyebrow: null,
    config: {},
    sort_order: 0,
    ...overrides,
  }
}

describe('isVisibleNow', () => {
  it('shows a row with no window at all', () => {
    expect(isVisibleNow({}, NOW)).toBe(true)
  })

  it('hides an explicitly inactive row even when the window is open', () => {
    expect(isVisibleNow({ is_active: false }, NOW)).toBe(false)
  })

  it('hides a row whose starts_at is in the future', () => {
    expect(isVisibleNow({ starts_at: '2026-07-27T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('treats starts_at exactly equal to now as visible (inclusive start)', () => {
    expect(isVisibleNow({ starts_at: NOW.toISOString() }, NOW)).toBe(true)
  })

  it('treats ends_at exactly equal to now as hidden (exclusive end)', () => {
    expect(isVisibleNow({ ends_at: NOW.toISOString() }, NOW)).toBe(false)
  })

  it('hides a row whose window has already closed', () => {
    expect(isVisibleNow({ ends_at: '2026-07-25T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('ignores an unparseable timestamp rather than hiding the row', () => {
    expect(isVisibleNow({ starts_at: 'not-a-date', ends_at: 'nope' }, NOW)).toBe(true)
  })
})

describe('toOrder', () => {
  it('coerces numeric strings and falls back to 0', () => {
    expect(toOrder('30')).toBe(30)
    expect(toOrder(null)).toBe(0)
    expect(toOrder(undefined)).toBe(0)
    expect(toOrder('abc')).toBe(0)
  })
})

describe('sortByOrder', () => {
  it('sorts ascending by sort_order then id, and never mutates the input', () => {
    const input = [
      { id: 'b', sort_order: 10 },
      { id: 'a', sort_order: 10 },
      { id: 'c', sort_order: 0 },
    ] as const
    const snapshot = input.map((row) => row.id)

    expect(sortByOrder(input).map((row) => row.id)).toEqual(['c', 'a', 'b'])
    expect(input.map((row) => row.id)).toEqual(snapshot)
  })

  it('handles numeric-string sort_order without lexicographic surprises', () => {
    const rows = [
      { id: 'x', sort_order: '100' },
      { id: 'y', sort_order: '20' },
    ]
    expect(sortByOrder(rows).map((row) => row.id)).toEqual(['y', 'x'])
  })
})

describe('mapBannerRow', () => {
  const base = {
    id: 'b1',
    name: 'Hero',
    slot: 'home_hero',
    title: 'T',
    subtitle: null,
    image_desktop_url: null,
    image_mobile_url: null,
    href: '/products',
    sort_order: '10',
  }

  it('maps snake_case to a camelCase DTO and coerces sort_order', () => {
    const banner = mapBannerRow(base)
    expect(banner).toMatchObject({ id: 'b1', slot: 'home_hero', href: '/products', sortOrder: 10 })
  })

  it('returns null for a slot this build does not know', () => {
    expect(mapBannerRow({ ...base, slot: 'home_mystery' })).toBeNull()
  })
})

describe('mapSectionRow', () => {
  it('maps a valid row and leaves collection unresolved', () => {
    const { section, warning } = mapSectionRow(sectionRow({ id: 's1', section_type: 'trust' }))
    expect(warning).toBeNull()
    expect(section).toMatchObject({ id: 's1', type: 'trust', collection: null })
  })

  it('drops a row with an unknown section_type and reports a warning', () => {
    const { section, warning } = mapSectionRow(sectionRow({ id: 's2', section_type: 'time_machine' }))
    expect(section).toBeNull()
    expect(warning).toContain('unknown section_type')
  })

  it('drops a row whose required config is missing', () => {
    const { section, warning } = mapSectionRow(
      sectionRow({ id: 's3', section_type: 'product_collection', config: {} }),
    )
    expect(section).toBeNull()
    expect(warning).toContain('invalid config')
  })

  it('falls back to defaults and warns when an optional config is malformed', () => {
    const { section, warning } = mapSectionRow(
      sectionRow({ id: 's4', section_type: 'hero', config: { showStats: 'yes' } }),
    )
    expect(section?.config).toMatchObject({ bannerSlot: 'home_hero', showStats: false })
    expect(warning).toContain('config fallback')
  })

  it('accepts a null config from the database', () => {
    const { section } = mapSectionRow(sectionRow({ id: 's5', section_type: 'guides', config: null }))
    expect(section?.config).toEqual({})
  })
})

describe('buildNavigationTree', () => {
  it('nests children under parents in sort order', () => {
    const tree = buildNavigationTree([
      navRow({ id: 'child-b', parent_id: 'root', sort_order: 20 }),
      navRow({ id: 'root', item_type: 'group', href: null }),
      navRow({ id: 'child-a', parent_id: 'root', sort_order: 10 }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].children.map((node) => node.id)).toEqual(['child-a', 'child-b'])
  })

  it('drops orphans instead of promoting them to top level', () => {
    const tree = buildNavigationTree([navRow({ id: 'orphan', parent_id: 'missing-parent' })])
    expect(tree).toEqual([])
  })

  it('drops inactive rows and their subtree', () => {
    const tree = buildNavigationTree([
      navRow({ id: 'root', is_active: false, item_type: 'group', href: null }),
      navRow({ id: 'child', parent_id: 'root' }),
    ])
    expect(tree).toEqual([])
  })

  it('trims anything deeper than three levels', () => {
    const tree = buildNavigationTree([
      navRow({ id: 'l1', item_type: 'group', href: null }),
      navRow({ id: 'l2', parent_id: 'l1', item_type: 'group', href: null }),
      navRow({ id: 'l3', parent_id: 'l2' }),
      navRow({ id: 'l4', parent_id: 'l3' }),
    ])
    expect(tree[0].children[0].children.map((node) => node.id)).toEqual(['l3'])
    expect(tree[0].children[0].children[0].children).toEqual([])
  })

  it('terminates on a parent_id cycle instead of recursing forever', () => {
    const tree = buildNavigationTree([
      navRow({ id: 'a', parent_id: 'b' }),
      navRow({ id: 'b', parent_id: 'a' }),
    ])
    expect(tree).toEqual([])
  })

  it('normalizes an unknown item_type, non-object metadata and open_in_new_tab', () => {
    const [node] = buildNavigationTree([
      navRow({ id: 'n1', item_type: 'hologram', metadata: ['nope'], open_in_new_tab: null }),
    ])
    expect(node.type).toBe('link')
    expect(node.metadata).toEqual({})
    expect(node.openInNewTab).toBe(false)
  })
})

describe('reorderByIds', () => {
  it('restores the requested order and drops unmatched ids', () => {
    const items = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
    expect(reorderByIds(items, ['p3', 'missing', 'p1']).map((item) => item.id)).toEqual(['p3', 'p1'])
  })

  it('returns an empty list when no ids are requested', () => {
    expect(reorderByIds([{ id: 'p1' }], [])).toEqual([])
  })
})
