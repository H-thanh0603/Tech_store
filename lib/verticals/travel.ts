/**
 * Travel vertical (ACME Travel demo): date-bound inventory + itinerary
 * presentation over the same planning primitives as retail.
 *
 * The shopping plan prices lines; travel adds a date window (inventory only
 * exists for concrete dates) and renders an `itinerary` extension for the host.
 */

export interface ItinerarySegmentInput {
  date: string
  label: string
  price: number
}

export interface ItineraryDraft {
  title: string
  window: { from: string; to: string }
  segments: Array<{ date: string; label: string; price: number; available: boolean }>
  total: number
  budget: number | null
  overBudget: boolean
  unavailable: string[]
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time)
}

/**
 * Build a date-bound itinerary. Availability comes from the caller's lookup
 * (date-bound inventory lives in the host system); unknown dates are treated
 * as unavailable, never guessed.
 */
export async function buildItinerary(
  input: { title?: string; budget?: number; segments: ItinerarySegmentInput[] },
  isAvailable: (date: string, label: string) => Promise<boolean> | boolean,
): Promise<ItineraryDraft> {
  const segments: ItineraryDraft['segments'] = []
  const unavailable: string[] = []
  let total = 0
  for (const seg of (input.segments ?? []).slice(0, 6)) {
    const price = Math.floor(Number(seg.price))
    if (!isDateOnly(seg.date) || !seg.label || !Number.isFinite(price) || price < 0) {
      unavailable.push(String(seg.label ?? seg.date))
      continue
    }
    const available = await isAvailable(seg.date, seg.label)
    if (!available) {
      unavailable.push(`${seg.label} (${seg.date})`)
      continue
    }
    total += price
    segments.push({ date: seg.date, label: seg.label.slice(0, 120), price, available: true })
  }
  const dates = segments.map((s) => s.date).sort()
  const budget =
    typeof input.budget === 'number' && Number.isFinite(input.budget) && input.budget > 0
      ? Math.floor(input.budget)
      : null
  return {
    title: (input.title ?? 'Lịch trình').slice(0, 120),
    window: { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' },
    segments,
    total,
    budget,
    overBudget: budget != null && total > budget,
    unavailable,
  }
}
