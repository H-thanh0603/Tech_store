/**
 * Guest wishlist / compare / recently-viewed via localStorage.
 * Stores compact product snapshots so pages work offline of full catalog fetch.
 */

export type StoredProductRef = {
  id: string
  slug: string
  name: string
  brandName: string | null
  minPrice: number
  imageUrl: string | null
  categorySlug: string
  savedAt: number
}

const WISHLIST_KEY = 'techstore_wishlist_v1'
const COMPARE_KEY = 'techstore_compare_v1'
const RECENT_KEY = 'techstore_recent_v1'
const MAX_COMPARE = 4
const MAX_RECENT = 12
let accountSyncEnabled = false
let accountSyncTimer: ReturnType<typeof setTimeout> | null = null

/** Stable empty array for SSR / initial client snapshot. */
const EMPTY: StoredProductRef[] = []

/** Cache raw localStorage string → list for useSyncExternalStore referential stability. */
const snapCache = new Map<string, { raw: string | null; list: StoredProductRef[] }>()

function parseList(raw: string | null): StoredProductRef[] {
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return EMPTY
    const list = parsed.filter(isStoredRef)
    return list.length === 0 ? EMPTY : list
  } catch {
    return EMPTY
  }
}

function getCachedList(key: string): StoredProductRef[] {
  if (typeof window === 'undefined') return EMPTY
  const raw = window.localStorage.getItem(key)
  const cached = snapCache.get(key)
  if (cached && cached.raw === raw) return cached.list
  const list = parseList(raw)
  snapCache.set(key, { raw, list })
  return list
}

function readList(key: string): StoredProductRef[] {
  return getCachedList(key)
}

function writeList(key: string, list: StoredProductRef[]) {
  if (typeof window === 'undefined') return
  try {
    const raw = JSON.stringify(list)
    window.localStorage.setItem(key, raw)
    snapCache.set(key, { raw, list: list.length === 0 ? EMPTY : list })
    window.dispatchEvent(new CustomEvent('techstore:lists-changed', { detail: { key } }))
    scheduleAccountSync()
  } catch {
    // quota / private mode
  }
}

export function mergeStoredLists(
  local: StoredProductRef[],
  server: StoredProductRef[],
  limit = Number.POSITIVE_INFINITY,
): StoredProductRef[] {
  const byId = new Map<string, StoredProductRef>()
  for (const item of [...local, ...server]) {
    const current = byId.get(item.id)
    if (!current || item.savedAt > current.savedAt) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, limit)
}

export function mergeAccountLists(input: { wishlist: StoredProductRef[]; compare: StoredProductRef[] }) {
  accountSyncEnabled = false
  writeList(WISHLIST_KEY, mergeStoredLists(getWishlist(), input.wishlist))
  writeList(COMPARE_KEY, mergeStoredLists(getCompare(), input.compare, MAX_COMPARE))
  accountSyncEnabled = true
  scheduleAccountSync()
}

function scheduleAccountSync() {
  if (!accountSyncEnabled || typeof fetch === 'undefined') return
  if (accountSyncTimer) clearTimeout(accountSyncTimer)
  accountSyncTimer = setTimeout(() => {
    accountSyncTimer = null
    void fetch('/api/account/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishlist: getWishlist(), compare: getCompare() }),
    })
  }, 250)
}

function isStoredRef(value: unknown): value is StoredProductRef {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.slug === 'string' && typeof v.name === 'string'
}

/** Subscribe to wishlist/compare/recent mutations (same-tab + cross-tab). */
export function subscribeLists(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('techstore:lists-changed', onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener('techstore:lists-changed', onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

export function getServerListSnapshot(): StoredProductRef[] {
  return EMPTY
}

export function getWishlistSnapshot(): StoredProductRef[] {
  return getCachedList(WISHLIST_KEY)
}

export function getCompareSnapshot(): StoredProductRef[] {
  return getCachedList(COMPARE_KEY)
}

export function getRecentlyViewedSnapshot(): StoredProductRef[] {
  return getCachedList(RECENT_KEY)
}

export function getWishlist(): StoredProductRef[] {
  return readList(WISHLIST_KEY)
}

export function isInWishlist(id: string): boolean {
  return getWishlist().some((p) => p.id === id)
}

export function toggleWishlist(product: Omit<StoredProductRef, 'savedAt'>): boolean {
  const list = getWishlist()
  const exists = list.some((p) => p.id === product.id)
  const next = exists
    ? list.filter((p) => p.id !== product.id)
    : [{ ...product, savedAt: Date.now() }, ...list]
  writeList(WISHLIST_KEY, next)
  return !exists
}

export function getCompare(): StoredProductRef[] {
  return readList(COMPARE_KEY)
}

export function isInCompare(id: string): boolean {
  return getCompare().some((p) => p.id === id)
}

export function toggleCompare(product: Omit<StoredProductRef, 'savedAt'>): {
  active: boolean
  full: boolean
} {
  const list = getCompare()
  const exists = list.some((p) => p.id === product.id)
  if (exists) {
    writeList(
      COMPARE_KEY,
      list.filter((p) => p.id !== product.id),
    )
    return { active: false, full: false }
  }
  if (list.length >= MAX_COMPARE) {
    return { active: false, full: true }
  }
  writeList(COMPARE_KEY, [{ ...product, savedAt: Date.now() }, ...list])
  return { active: true, full: false }
}

export function clearCompare() {
  writeList(COMPARE_KEY, [])
}

export function pushRecentlyViewed(product: Omit<StoredProductRef, 'savedAt'>) {
  const list = getRecentlyViewed().filter((p) => p.id !== product.id)
  writeList(RECENT_KEY, [{ ...product, savedAt: Date.now() }, ...list].slice(0, MAX_RECENT))
}

export function getRecentlyViewed(): StoredProductRef[] {
  return readList(RECENT_KEY)
}

export function toStoredRef(product: {
  id: string
  slug: string
  name: string
  brandName?: string | null
  minPrice: number
  imageUrl?: string | null
  categorySlug: string
}): Omit<StoredProductRef, 'savedAt'> {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brandName: product.brandName ?? null,
    minPrice: product.minPrice,
    imageUrl: product.imageUrl ?? null,
    categorySlug: product.categorySlug,
  }
}
