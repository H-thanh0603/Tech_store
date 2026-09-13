import { describe, expect, it } from 'vitest'

import { feePreservingPriceMove, HoldBook } from '@/lib/verticals/entertainment'

describe('entertainment vertical', () => {
  it('holds real capacity with expiry and releases it back', () => {
    const now = 1_000_000
    const book = new HoldBook(() => now)
    const hold = book.createHold('show-1', 2, 15)
    expect(hold?.status).toBe('held')
    expect(book.releaseHold(hold?.hold_id ?? '')).toEqual({ released: true, capacityBack: 2 })
    expect(book.releaseHold(hold?.hold_id ?? '').released).toBe(false)
  })

  it('sweeps expired holds into freed capacity', () => {
    let now = 1_000_000
    const book = new HoldBook(() => now)
    book.createHold('show-1', 3, 5)
    now += 6 * 60_000
    expect(book.sweepExpired()).toEqual([{ event_id: 'show-1', capacityBack: 3 }])
    expect(book.sweepExpired()).toEqual([])
  })

  it('rejects bad holds and keeps waitlists idempotent without PII', () => {
    const book = new HoldBook(() => 0)
    expect(book.createHold('show-1', 0)).toBeNull()
    expect(book.createHold('show-1', 11)).toBeNull()
    expect(book.joinWaitlist('show-1', 'sess-a')).toEqual({ event_id: 'show-1', position: 1 })
    expect(book.joinWaitlist('show-1', 'sess-a').position).toBe(1)
    expect(book.joinWaitlist('show-1', 'sess-b').position).toBe(2)
  })

  it('moves base price within +-20% while fees stay constant', () => {
    const moved = feePreservingPriceMove(500000, [{ label: 'Phí dịch vụ', amount: 50000 }], -10)
    expect(moved).toMatchObject({ base: 450000, allIn: 500000 })
    expect(feePreservingPriceMove(500000, [], 25)).toBeNull()
  })
})
