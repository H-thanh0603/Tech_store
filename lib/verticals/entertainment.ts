/**
 * Entertainment vertical (ACME Tickets demo): timed holds, waitlists,
 * transfers and fee-preserving price moves. Holds are real capacity promises
 * with expiry — the host enforces them; this module shapes the data and the
 * `hold-status` / `fee-disclosure` presentation payloads.
 */

export interface TicketHold {
  hold_id: string
  event_id: string
  quantity: number
  status: 'held' | 'released' | 'expired'
  expires_at: string
}

export interface WaitlistEntry {
  event_id: string
  position: number
}

let holdSeq = 0

function isoAfter(now: number, ttlMinutes: number): string {
  return new Date(now + Math.max(1, Math.floor(ttlMinutes)) * 60_000).toISOString()
}

/** In-memory hold book with an injectable clock (tests + demos). */
export class HoldBook {
  private holds = new Map<string, TicketHold>()
  private waitlists = new Map<string, string[]>()

  constructor(private now: () => number = () => Date.now()) {}

  /** Stage a timed hold: quantity 1–10, TTL 5–60 minutes. */
  createHold(eventId: string, quantity: number, ttlMinutes = 15): TicketHold | null {
    const qty = Math.floor(quantity)
    if (!eventId || !Number.isFinite(qty) || qty < 1 || qty > 10) return null
    const ttl = Math.min(60, Math.max(5, Math.floor(ttlMinutes)))
    holdSeq += 1
    const hold: TicketHold = {
      hold_id: `hold-${this.now()}-${holdSeq}`,
      event_id: eventId.slice(0, 80),
      quantity: qty,
      status: 'held',
      expires_at: isoAfter(this.now(), ttl),
    }
    this.holds.set(hold.hold_id, hold)
    return hold
  }

  /** Release a hold early: its quantity returns to real capacity. */
  releaseHold(holdId: string): { released: boolean; capacityBack: number } {
    const hold = this.holds.get(holdId)
    if (!hold || hold.status !== 'held') return { released: false, capacityBack: 0 }
    hold.status = 'released'
    return { released: true, capacityBack: hold.quantity }
  }

  /** Sweep expired holds; returns the freed capacity per event. */
  sweepExpired(): Array<{ event_id: string; capacityBack: number }> {
    const freed = new Map<string, number>()
    for (const hold of this.holds.values()) {
      if (hold.status === 'held' && Date.parse(hold.expires_at) <= this.now()) {
        hold.status = 'expired'
        freed.set(hold.event_id, (freed.get(hold.event_id) ?? 0) + hold.quantity)
      }
    }
    return [...freed.entries()].map(([event_id, capacityBack]) => ({ event_id, capacityBack }))
  }

  /** Join the waitlist (session-scoped key, no PII). Idempotent per key. */
  joinWaitlist(eventId: string, sessionKey: string): WaitlistEntry {
    const list = this.waitlists.get(eventId) ?? []
    if (!list.includes(sessionKey)) list.push(sessionKey)
    this.waitlists.set(eventId, list)
    return { event_id: eventId, position: list.indexOf(sessionKey) + 1 }
  }
}

/**
 * Fee-preserving price move: the base price moves by deltaPct (±20%),
 * regulated/all-in fees stay constant — the guest never pays a moved fee.
 */
export function feePreservingPriceMove(
  basePrice: number,
  fees: Array<{ label: string; amount: number }>,
  deltaPct: number,
): { base: number; fees: Array<{ label: string; amount: number }>; allIn: number } | null {
  const base = Math.floor(Number(basePrice))
  const pct = Number(deltaPct)
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || Math.abs(pct) > 20) return null
  const moved = Math.floor(base * (1 + pct / 100))
  const clean = fees.map((f) => ({ label: String(f.label).slice(0, 80), amount: Math.max(0, Math.floor(Number(f.amount))) }))
  return { base: moved, fees: clean, allIn: moved + clean.reduce((s, f) => s + f.amount, 0) }
}
