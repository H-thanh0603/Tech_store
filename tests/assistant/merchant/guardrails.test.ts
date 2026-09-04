import { describe, expect, it } from 'vitest'

import {
  checkGuardrails,
  nextChangeId,
  signChange,
  verifySignedChange,
  type LiveItemState,
  type StagedChange,
} from '@/lib/assistant/merchant/guardrails'

function live(): Map<string, LiveItemState> {
  return new Map([
    ['p1', { productId: 'p1', name: 'Laptop A', minPrice: 10_000_000, availableStock: 5 }],
    ['p2', { productId: 'p2', name: 'Phone B', minPrice: 5_000_000, availableStock: 0 }],
  ])
}

function baseChange(): StagedChange {
  return {
    id: nextChangeId(),
    kind: 'price',
    summary: 'Giảm giá 10% — 1 sản phẩm',
    note: null,
    action: { kind: 'price', productIds: ['p1'], mode: 'percent_down', value: 10 },
    items: [{ productId: 'p1', name: 'Laptop A', before: '10.000.000 ₫', after: '9.000.000 ₫' }],
    createdAt: new Date().toISOString(),
  }
}

describe('merchant guardrails', () => {
  it('passes a sane price change', () => {
    const check = checkGuardrails(
      { kind: 'price', productIds: ['p1'], mode: 'percent_down', value: 10 },
      live(),
    )
    expect(check.ok).toBe(true)
  })

  it('blocks price moves over the per-change cap', () => {
    const check = checkGuardrails(
      { kind: 'price', productIds: ['p1'], mode: 'percent_down', value: 50 },
      live(),
    )
    expect(check.ok).toBe(false)
    expect(check.violations.join(' ')).toMatch(/20%/)
  })

  it('blocks unknown (unstaged-read) ids', () => {
    const check = checkGuardrails(
      { kind: 'publish', target: 'publish', productIds: ['ghost'] },
      live(),
    )
    expect(check.ok).toBe(false)
  })

  it('blocks duplicate targets and oversized changes', () => {
    const dupes = checkGuardrails(
      { kind: 'publish', target: 'publish', productIds: ['p1', 'p1'] },
      live(),
    )
    expect(dupes.ok).toBe(false)

    const big = checkGuardrails(
      { kind: 'publish', target: 'publish', productIds: Array.from({ length: 11 }, (_, i) => `p${i}`) },
      live(),
    )
    expect(big.ok).toBe(false)
    expect(big.violations.join(' ')).toMatch(/10\/change/)
  })

  it('bounds stock quantities and restocks', () => {
    const bad = checkGuardrails({ kind: 'stock', productIds: ['p1'], quantity: -1 }, live())
    expect(bad.ok).toBe(false)
    const huge = checkGuardrails({ kind: 'stock', productIds: ['p1'], quantity: 5000 }, live())
    expect(huge.ok).toBe(false)
    const fine = checkGuardrails({ kind: 'stock', productIds: ['p2'], quantity: 20 }, live())
    expect(fine.ok).toBe(true)
  })

  it('signs envelopes and detects tampering', () => {
    const signed = signChange(baseChange())
    expect(verifySignedChange(signed)).toBe(true)
    const tampered = {
      ...signed,
      change: {
        ...signed.change,
        action: { kind: 'price' as const, productIds: ['p1'], mode: 'percent_down' as const, value: 90 },
      },
    }
    expect(verifySignedChange(tampered)).toBe(false)
    expect(verifySignedChange({ ...signed, signature: '0'.repeat(64) })).toBe(false)
  })
})
