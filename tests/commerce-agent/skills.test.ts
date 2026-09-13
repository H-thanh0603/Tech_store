import { describe, expect, it } from 'vitest'

import { ALL_SKILLS, enabledToolNames, MERCHANT_SKILLS, SHOPPING_SKILLS, stagedSkills } from '@/lib/commerce-agent/skills'

describe('skill registry', () => {
  it('defines the five shopping and five merchant flows once', () => {
    expect(SHOPPING_SKILLS.map((s) => s.name).sort()).toEqual(
      ['customer-care', 'memory-personalization', 'planning-goals', 'purchase-research', 'search-discovery'].sort(),
    )
    expect(MERCHANT_SKILLS.map((s) => s.name).sort()).toEqual(
      ['catalog-listings', 'inventory-operations', 'marketing-campaigns', 'performance-insights', 'pricing-promotions'].sort(),
    )
    expect(ALL_SKILLS).toHaveLength(10)
  })

  it('exposes enabled tools per role including the presentation tool', () => {
    const shopping = enabledToolNames('shopping')
    for (const tool of ['search_products', 'compare_products', 'create_shopping_plan', 'track_order', 'search_policies', 'present_suggestions']) {
      expect(shopping).toContain(tool)
    }
    const merchant = enabledToolNames('merchant')
    for (const tool of ['get_business_snapshot', 'stage_price_change', 'draft_campaign_brief', 'run_analysis', 'present_suggestions']) {
      expect(merchant).toContain(tool)
    }
  })

  it('parks switched-off flows as staged', () => {
    // Defaults: memory extraction is rule-based (skill parked), everything else on.
    expect(stagedSkills().map((s) => s.name)).toEqual(['memory-personalization'])
  })
})
