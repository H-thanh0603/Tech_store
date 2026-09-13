import { describe, expect, it } from 'vitest'

import { prefixCacheHit, turnCompleteEvent } from '@/lib/commerce-agent/events'
import { presentationExtensions, renderPresentation } from '@/lib/commerce-agent/presentation'

describe('turn events', () => {
  it('reports cache health from the usage probe', () => {
    expect(prefixCacheHit({ cacheReadInputTokens: 1200 })).toBe(true)
    expect(prefixCacheHit({ cacheReadInputTokens: 0 })).toBe(false)
    expect(prefixCacheHit(null)).toBe(false)
    expect(turnCompleteEvent({ cacheReadInputTokens: 5 })).toEqual({
      type: 'turn_complete',
      cachedPrefixHit: true,
    })
  })
})

describe('presentation extensions', () => {
  it('registers the retail plus vertical extensions', () => {
    expect(presentationExtensions()).toEqual(
      expect.arrayContaining(['suggestions', 'comparison', 'shopping-plan', 'itinerary', 'plan-matrix', 'fee-disclosure', 'hold-status']),
    )
  })

  it('renders suggestions, comparison and plans, rejects bad input', () => {
    expect(renderPresentation('suggestions', { suggestions: ['a', 'b'] })?.data).toEqual({ chips: ['a', 'b'] })
    expect(renderPresentation('suggestions', {})).toBeNull()
    expect(
      renderPresentation('comparison', { rows: [{ slug: 'a' }, { slug: 'b' }], summary: { cheapest: null } }),
    )?.toMatchObject({ extension: 'comparison' })
    expect(renderPresentation('comparison', { rows: [{ slug: 'a' }] })).toBeNull()
    expect(
      renderPresentation('shopping-plan', { title: 'T', lines: [], total: 0, budget: 10, overBudget: false })?.data,
    ).toMatchObject({ title: 'T', overBudget: false })
    expect(renderPresentation('nope', {})).toBeNull()
  })

  it('renders vertical payloads', () => {
    expect(renderPresentation('itinerary', { segments: [{ day: 1 }], total: 5 })?.extension).toBe('itinerary')
    expect(renderPresentation('itinerary', {})).toBeNull()
    expect(renderPresentation('fee-disclosure', { fees: [], total: 0, allIn: true })?.data).toMatchObject({ allIn: true })
    expect(renderPresentation('hold-status', { hold_id: 'h', expires_at: 't' })?.extension).toBe('hold-status')
    expect(renderPresentation('hold-status', { hold_id: 'h' })).toBeNull()
  })
})
