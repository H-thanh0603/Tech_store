/** First-party storefront analytics. Never include PII in payloads. */

export const ANALYTICS_EVENT_NAMES = [
  'hero_cta_click', 'category_click', 'search_performed', 'search_no_result',
  'filter_applied', 'sort_changed', 'product_viewed', 'variant_selected',
  'add_to_cart', 'remove_from_cart', 'begin_checkout', 'checkout_error',
  'order_completed', 'wishlist_toggle', 'compare_toggle', 'guide_opened',
  'mini_cart_open', 'recently_viewed_click', 'web_vital',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number]
export type AnalyticsValue = string | number | boolean | null
export type AnalyticsPayload = Record<string, AnalyticsValue | undefined>

export interface AnalyticsEvent {
  event: AnalyticsEventName
  payload: Record<string, AnalyticsValue>
  sessionId: string
  ts: number
}

const ENDPOINT = '/api/analytics/events'
const BATCH_SIZE = 10
const FLUSH_MS = 5_000
const BLOCKED = /phone|email|address|password|secret|token|name|query|term/i
let queue: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let lifecycleReady = false
let sessionId: string | null = null

export function sanitizeAnalyticsPayload(payload: AnalyticsPayload): Record<string, AnalyticsValue> {
  const out: Record<string, AnalyticsValue> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED.test(key) || value === undefined) continue
    out[key] = typeof value === 'string' ? value.slice(0, 160) : value
  }
  return out
}

export function track(event: AnalyticsEventName, payload: AnalyticsPayload = {}): void {
  if (typeof window === 'undefined') return

  const detail: AnalyticsEvent = {
    event,
    payload: sanitizeAnalyticsPayload(payload),
    sessionId: getSessionId(),
    ts: Date.now(),
  }

  try {
    window.dispatchEvent(new CustomEvent('techstore:analytics', { detail }))
  } catch {
    // Analytics must never block the storefront action being measured.
  }
  queue.push(detail)
  prepareLifecycle()

  if (queue.length >= BATCH_SIZE) {
    void flush()
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => void flush(), FLUSH_MS)
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', detail.event, detail.payload)
  }
}

function getSessionId(): string {
  if (sessionId) return sessionId
  try {
    const stored = window.sessionStorage.getItem('techstore_analytics_session')
    sessionId = stored ?? crypto.randomUUID()
    if (!stored) window.sessionStorage.setItem('techstore_analytics_session', sessionId)
  } catch {
    sessionId = crypto.randomUUID()
  }
  return sessionId
}

function prepareLifecycle(): void {
  if (lifecycleReady) return
  lifecycleReady = true
  window.addEventListener('pagehide', flushWithBeacon)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushWithBeacon()
  })
}

async function flush(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  if (queue.length === 0) return

  const events = queue.splice(0, BATCH_SIZE)
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    })
    if (!response.ok) throw new Error('analytics rejected')
  } catch {
    queue = [...events, ...queue].slice(0, BATCH_SIZE * 3)
  }

  if (queue.length > 0 && !flushTimer) {
    flushTimer = setTimeout(() => void flush(), FLUSH_MS)
  }
}

function flushWithBeacon(): void {
  if (queue.length === 0) return
  const events = queue.splice(0, BATCH_SIZE)
  const accepted = navigator.sendBeacon(
    ENDPOINT,
    new Blob([JSON.stringify({ events })], { type: 'application/json' }),
  )
  if (!accepted) queue = [...events, ...queue]
}
