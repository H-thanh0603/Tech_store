// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import {
  mergeStoredLists,
  clearCompare,
  getCompare,
  getWishlist,
  isInCompare,
  isInWishlist,
  toggleCompare,
  toggleWishlist,
} from '@/lib/customer/local-lists'

const sample = {
  id: 'p1',
  slug: 'macbook',
  name: 'MacBook',
  brandName: 'Apple',
  minPrice: 1000,
  imageUrl: null,
  categorySlug: 'laptop',
}

describe('guest local lists', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('toggles wishlist', () => {
    expect(isInWishlist('p1')).toBe(false)
    expect(toggleWishlist(sample)).toBe(true)
    expect(isInWishlist('p1')).toBe(true)
    expect(getWishlist()).toHaveLength(1)
    expect(toggleWishlist(sample)).toBe(false)
    expect(getWishlist()).toHaveLength(0)
  })

  it('limits compare to 4 items', () => {
    for (let i = 0; i < 4; i += 1) {
      const r = toggleCompare({ ...sample, id: `p${i}`, slug: `s${i}`, name: `P${i}` })
      expect(r.active).toBe(true)
    }
    expect(getCompare()).toHaveLength(4)
    const full = toggleCompare({ ...sample, id: 'p9', slug: 's9', name: 'P9' })
    expect(full.full).toBe(true)
    expect(getCompare()).toHaveLength(4)
    clearCompare()
    expect(getCompare()).toHaveLength(0)
    expect(isInCompare('p0')).toBe(false)
  })

  it('merges device and account lists by product, newest first, within the limit', () => {
    const local = [{ ...sample, savedAt: 10 }]
    const server = [
      { ...sample, savedAt: 5 },
      { ...sample, id: 'p2', slug: 'phone', name: 'Phone', savedAt: 20 },
    ]

    expect(mergeStoredLists(local, server, 4).map((item) => item.id)).toEqual(['p2', 'p1'])
  })
})
