/**
 * Pure helpers for admin dashboard KPI math (unit-testable without DB).
 * Revenue-eligible order statuses exclude cancelled and expired.
 */

export const REVENUE_EXCLUDED_STATUSES = ['cancelled', 'expired'] as const

export function isRevenueEligibleStatus(status: string): boolean {
  return !REVENUE_EXCLUDED_STATUSES.includes(
    status as (typeof REVENUE_EXCLUDED_STATUSES)[number],
  )
}

/** Average order value; returns 0 when there are no orders (never divide by zero). */
export function calculateAov(revenue: number, orderCount: number): number {
  if (!Number.isFinite(revenue) || !Number.isFinite(orderCount) || orderCount <= 0) {
    return 0
  }
  return revenue / orderCount
}

/**
 * Percent change vs previous period.
 * Returns null when previous is 0 (avoid fake infinity / misleading %).
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function clampRangeDays(days: number): 7 | 30 | 90 {
  if (days <= 7) return 7
  if (days <= 30) return 30
  return 90
}

export const STORE_TIMEZONE = 'Asia/Ho_Chi_Minh'
