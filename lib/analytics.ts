/**
 * Lightweight analytics surface for storefront events (design.md §28).
 * No third-party scripts; dispatches CustomEvent + optional console in dev.
 * Never log PII (phone, email, address).
 */

export type AnalyticsEventName =
  | 'hero_cta_click'
  | 'category_click'
  | 'search_performed'
  | 'search_no_result'
  | 'filter_applied'
  | 'sort_changed'
  | 'product_viewed'
  | 'variant_selected'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'checkout_error'
  | 'order_completed'
  | 'wishlist_toggle'
  | 'compare_toggle'
  | 'guide_opened'
  | 'mini_cart_open'
  | 'recently_viewed_click'

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

export function track(event: AnalyticsEventName, payload: AnalyticsPayload = {}): void {
  if (typeof window === 'undefined') return

  const detail = {
    event,
    payload: sanitize(payload),
    ts: Date.now(),
  }

  try {
    window.dispatchEvent(new CustomEvent('techstore:analytics', { detail }))
  } catch {
    // ignore
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', detail.event, detail.payload)
  }
}

const BLOCKED = /phone|email|address|password|secret|token|name/i

function sanitize(payload: AnalyticsPayload): AnalyticsPayload {
  const out: AnalyticsPayload = {}
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED.test(key)) continue
    if (value === undefined) continue
    out[key] = value
  }
  return out
}
