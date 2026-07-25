import { describe, expect, it } from 'vitest'

import { parseSectionConfig, safeHref } from '@/lib/content/config-schemas'
import { SECTION_TYPES } from '@/lib/content/types'

describe('safeHref', () => {
  it('accepts a root-relative path', () => {
    expect(safeHref.safeParse('/products?category=laptop').success).toBe(true)
  })

  it('accepts an https URL', () => {
    expect(safeHref.safeParse('https://example.com/promo').success).toBe(true)
  })

  it('rejects a javascript: URL', () => {
    expect(safeHref.safeParse('javascript:alert(1)').success).toBe(false)
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeHref.safeParse('//evil.example.com').success).toBe(false)
  })

  it('rejects plain http and hrefs containing whitespace', () => {
    expect(safeHref.safeParse('http://example.com').success).toBe(false)
    expect(safeHref.safeParse('/products ?x=1').success).toBe(false)
  })
})

describe('parseSectionConfig', () => {
  it('applies defaults for a hero section', () => {
    const { config, error } = parseSectionConfig('hero', {})

    expect(error).toBeNull()
    expect(config).toEqual({ bannerSlot: 'home_hero', showStats: false })
  })

  it('rejects unknown keys but keeps the section renderable', () => {
    const { config, error } = parseSectionConfig('hero', { showStats: true, onclick: 'boom' })

    expect(error).toBeTruthy()
    // Fallback to schema defaults: one bad config must not break the section.
    expect(config).toEqual({ bannerSlot: 'home_hero', showStats: false })
  })

  it('rejects an unsafe cta href on a hero section', () => {
    const { error } = parseSectionConfig('hero', { ctaHref: 'javascript:alert(1)' })

    expect(error).toBeTruthy()
  })

  it('applies defaults for a product_collection section', () => {
    const { config, error } = parseSectionConfig('product_collection', { collectionSlug: 'deal-soc' })

    expect(error).toBeNull()
    expect(config).toEqual({ collectionSlug: 'deal-soc', limit: 8, layout: 'grid' })
  })

  it('returns a null config when collectionSlug is missing', () => {
    const { config, error } = parseSectionConfig('product_collection', {})

    expect(error).toBeTruthy()
    expect(config).toBeNull()
  })

  it('rejects a limit outside the allowed range', () => {
    const { config, error } = parseSectionConfig('product_collection', {
      collectionSlug: 'deal-soc',
      limit: 99,
    })

    expect(error).toBeTruthy()
    expect(config).toBeNull()
  })

  it('rejects a banner_grid slot that is reserved for the hero', () => {
    const { config, error } = parseSectionConfig('banner_grid', { bannerSlot: 'home_hero' })

    expect(error).toBeTruthy()
    expect(config).toBeNull()
  })

  it('accepts a valid banner_grid config', () => {
    const { config, error } = parseSectionConfig('banner_grid', { bannerSlot: 'home_promo_grid' })

    expect(error).toBeNull()
    expect(config).toEqual({ bannerSlot: 'home_promo_grid', limit: 3 })
  })

  it('rejects a non-object config', () => {
    expect(parseSectionConfig('trust', ['nope']).error).toBeTruthy()
    expect(parseSectionConfig('trust', 'nope').error).toBeTruthy()
  })

  it('has a schema for every section type', () => {
    const typesRequiringConfig = new Set(['banner_grid', 'product_collection'])

    for (const type of SECTION_TYPES) {
      const { config, error } = parseSectionConfig(type, {})

      if (typesRequiringConfig.has(type)) {
        expect(error, type).toBeTruthy()
      } else {
        expect(error, type).toBeNull()
        expect(config, type).not.toBeNull()
      }
    }
  })
})
