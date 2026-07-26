/**
 * Recent search terms (localStorage).
 *
 * Client-only and deliberately minimal: terms are trimmed, length-capped and
 * de-duplicated case-insensitively, and nothing is ever sent to the server.
 * Snapshots are cached so `useSyncExternalStore` sees a stable reference and
 * does not re-render on every read.
 */

const KEY = 'techstore_recent_searches_v1'
const MAX_ITEMS = 6
const MAX_TERM_LENGTH = 64
const EVENT = 'techstore:recent-searches-changed'

const EMPTY: readonly string[] = []

let snapshot: string[] | null = null
let snapshotRaw: string | null = null

function normalize(term: string): string {
  return term.trim().replace(/\s+/g, ' ').slice(0, MAX_TERM_LENGTH)
}

export function getRecentSearches(): readonly string[] {
  if (typeof window === 'undefined') {
    return EMPTY
  }
  const raw = window.localStorage.getItem(KEY)
  if (snapshot && snapshotRaw === raw) {
    return snapshot
  }
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    snapshot = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_ITEMS)
      : []
  } catch {
    snapshot = []
  }
  snapshotRaw = raw
  return snapshot
}

/** Server snapshot for useSyncExternalStore — must be referentially stable. */
export function getServerRecentSearches(): readonly string[] {
  return EMPTY
}

function write(next: string[]) {
  snapshot = next
  snapshotRaw = JSON.stringify(next)
  try {
    window.localStorage.setItem(KEY, snapshotRaw)
  } catch {
    // Quota or private mode: recent searches are a convenience, never critical.
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function pushRecentSearch(term: string): readonly string[] {
  if (typeof window === 'undefined') {
    return EMPTY
  }
  const normalized = normalize(term)
  if (!normalized) {
    return getRecentSearches()
  }
  const lower = normalized.toLowerCase()
  const next = [normalized, ...getRecentSearches().filter((t) => t.toLowerCase() !== lower)].slice(
    0,
    MAX_ITEMS,
  )
  write(next)
  return next
}

export function clearRecentSearches() {
  if (typeof window === 'undefined') {
    return
  }
  write([])
}

export function subscribeRecentSearches(onChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
