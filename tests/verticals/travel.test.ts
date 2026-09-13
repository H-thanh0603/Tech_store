import { describe, expect, it } from 'vitest'

import { buildItinerary, isDateOnly } from '@/lib/verticals/travel'

describe('travel vertical', () => {
  it('validates date-only strings', () => {
    expect(isDateOnly('2026-10-01')).toBe(true)
    expect(isDateOnly('01/10/2026')).toBe(false)
    expect(isDateOnly('2026-13-40')).toBe(false)
  })

  it('builds a date-bound itinerary with budget check', async () => {
    const draft = await buildItinerary(
      {
        title: 'Đà Lạt 3N2Đ',
        budget: 10000000,
        segments: [
          { date: '2026-10-01', label: 'Khách sạn', price: 3000000 },
          { date: '2026-10-02', label: 'Tour săn mây', price: 8000000 },
          { date: 'mùng 1', label: 'Xế hộp', price: 1000000 },
        ],
      },
      async () => true,
    )
    expect(draft.segments).toHaveLength(2)
    expect(draft.total).toBe(11000000)
    expect(draft.overBudget).toBe(true)
    expect(draft.window).toEqual({ from: '2026-10-01', to: '2026-10-02' })
    expect(draft.unavailable).toHaveLength(1)
  })

  it('never guesses unavailable dates', async () => {
    const draft = await buildItinerary(
      { segments: [{ date: '2026-10-01', label: 'Vé', price: 500000 }] },
      async () => false,
    )
    expect(draft.segments).toHaveLength(0)
    expect(draft.unavailable).toEqual(['Vé (2026-10-01)'])
  })
})
