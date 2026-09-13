/**
 * Telecom vertical (ACME Mobile demo): account-context plan matrix with
 * server-authored fee disclosures. The price quoted is always the session
 * account's; regulated fees are protected (never discounted away).
 */

export interface TelecomPlan {
  name: string
  monthlyFee: number
  dataGb: number
  lines: number
}

export interface PlanMatrix {
  plans: Array<TelecomPlan & { allInMonthly: number }>
  cheapest: string | null
  disclosure: ReturnType<typeof disclosureStatement>
}

export interface FeeLine {
  label: string
  amount: number
  /** Regulated fees survive discounts and price moves. */
  regulated?: boolean
}

/** Server-authored disclosure: every fee line stated, all-in total explicit. */
export function disclosureStatement(fees: FeeLine[]): { fees: FeeLine[]; total: number; allIn: boolean } {
  const clean = fees
    .filter((f) => Number.isFinite(Number(f.amount)) && Number(f.amount) >= 0)
    .map((f) => ({ label: String(f.label).slice(0, 80), amount: Math.floor(Number(f.amount)), regulated: f.regulated === true }))
  const total = clean.reduce((sum, f) => sum + f.amount, 0)
  return { fees: clean, total, allIn: true }
}

/**
 * Compare plans side by side for `lines` account lines: recurring fee +
 * per-line regulated fee, disclosed all-in. No promotional guessing — the
 * input plans are the session account's quoted prices.
 */
export function buildPlanMatrix(plans: TelecomPlan[], regulatedFeePerLine: number, lines: number): PlanMatrix {
  const perLine = Math.max(0, Math.floor(regulatedFeePerLine))
  const lineCount = Math.max(1, Math.floor(lines))
  const rows = plans.slice(0, 4).map((p) => {
    const monthly = Math.max(0, Math.floor(p.monthlyFee))
    const feeLines = disclosureStatement([
      { label: `Cước gói ${p.name}`, amount: monthly },
      { label: 'Phí quản lý thuê bao', amount: perLine * lineCount, regulated: true },
    ])
    return {
      name: p.name.slice(0, 80),
      monthlyFee: monthly,
      dataGb: p.dataGb,
      lines: lineCount,
      allInMonthly: feeLines.total,
    }
  })
  const byTotal = [...rows].sort((a, b) => a.allInMonthly - b.allInMonthly)
  return {
    plans: rows,
    cheapest: byTotal.length > 0 ? byTotal[0].name : null,
    disclosure: disclosureStatement([
      { label: 'Phí quản lý thuê bao', amount: perLine * lineCount, regulated: true },
    ]),
  }
}
