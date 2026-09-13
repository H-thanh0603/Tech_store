import { describe, expect, it } from 'vitest'

import { buildPlanMatrix, disclosureStatement } from '@/lib/verticals/telecom'

describe('telecom vertical', () => {
  it('states every fee with an all-in total', () => {
    const d = disclosureStatement([
      { label: 'Cước gói', amount: 199000 },
      { label: 'Phí quản lý', amount: 10000, regulated: true },
    ])
    expect(d.total).toBe(209000)
    expect(d.allIn).toBe(true)
  })

  it('quotes the session account all-in with protected regulated fees', () => {
    const matrix = buildPlanMatrix(
      [
        { name: 'Max5G', monthlyFee: 199000, dataGb: 120, lines: 2 },
        { name: 'Lite', monthlyFee: 99000, dataGb: 30, lines: 2 },
      ],
      10000,
      2,
    )
    expect(matrix.cheapest).toBe('Lite')
    const lite = matrix.plans.find((p) => p.name === 'Lite')
    expect(lite?.allInMonthly).toBe(99000 + 20000)
    expect(matrix.disclosure.fees[0].regulated).toBe(true)
  })
})
