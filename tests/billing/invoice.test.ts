import { describe, expect, it } from 'vitest'

import { buildInvoiceDraft, isValidTaxCode } from '@/lib/billing/invoice'

describe('internal invoice', () => {
  it('validates Vietnamese tax codes', () => {
    expect(isValidTaxCode(null)).toBe(true)
    expect(isValidTaxCode('0312345678')).toBe(true)
    expect(isValidTaxCode('0312345678-001')).toBe(true)
    expect(isValidTaxCode('abc')).toBe(false)
  })

  it('builds a numbered draft with VAT split', () => {
    const draft = buildInvoiceDraft(
      { orderCode: 'TS-1', orderTotal: 1100000, customerName: 'Nguyen Van A', taxCode: '0312345678' },
      7,
      new Date('2026-09-12T00:00:00Z'),
    )
    expect(draft.invoiceNumber).toBe('INV-20260912-000007')
    expect(draft.vatAmount).toBe(100000)
    expect(() =>
      buildInvoiceDraft({ orderCode: 'TS-1', orderTotal: 0, customerName: 'A' }, 1),
    ).toThrow()
  })
})
