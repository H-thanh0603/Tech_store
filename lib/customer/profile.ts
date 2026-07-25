/**
 * Guest/customer profile + saved order codes (localStorage).
 * Prefills checkout; account page aggregates lists without server auth dependency.
 */

export type CustomerProfile = {
  fullName: string
  phone: string
  email: string
  addressLine: string
  city: string
  district: string
  updatedAt: number
}

export type SavedOrderRef = {
  code: string
  total?: number
  savedAt: number
}

const PROFILE_KEY = 'techstore_customer_profile_v1'
const ORDERS_KEY = 'techstore_saved_orders_v1'
const SESSION_KEY = 'techstore_customer_session_v1'

export type CustomerSession = {
  email: string
  displayName: string
  loggedInAt: number
}

const EMPTY_PROFILE: CustomerProfile = {
  fullName: '',
  phone: '',
  email: '',
  addressLine: '',
  city: '',
  district: '',
  updatedAt: 0,
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent('techstore:customer-changed', { detail: { key } }))
  } catch {
    // quota
  }
}

/** Cached snapshot for useSyncExternalStore referential stability. */
let profileSnap: CustomerProfile | null = null
let profileRaw: string | null = null
let ordersSnap: SavedOrderRef[] | null = null
let ordersRaw: string | null = null
let sessionSnap: CustomerSession | null | undefined
let sessionRaw: string | null = null

export function getProfile(): CustomerProfile {
  if (typeof window === 'undefined') return EMPTY_PROFILE
  const raw = window.localStorage.getItem(PROFILE_KEY)
  if (profileSnap && profileRaw === raw) return profileSnap
  const p = raw ? (JSON.parse(raw) as Partial<CustomerProfile>) : {}
  profileSnap = { ...EMPTY_PROFILE, ...p }
  profileRaw = raw
  return profileSnap
}

export function saveProfile(input: Partial<CustomerProfile>): CustomerProfile {
  const next: CustomerProfile = {
    ...getProfile(),
    ...input,
    updatedAt: Date.now(),
  }
  writeJson(PROFILE_KEY, next)
  profileSnap = next
  profileRaw = JSON.stringify(next)
  return next
}

export function getSavedOrders(): SavedOrderRef[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(ORDERS_KEY)
  if (ordersSnap && ordersRaw === raw) return ordersSnap
  try {
    const list = raw ? (JSON.parse(raw) as SavedOrderRef[]) : []
    ordersSnap = Array.isArray(list) ? list : []
  } catch {
    ordersSnap = []
  }
  ordersRaw = raw
  return ordersSnap
}

export function pushSavedOrder(code: string, total?: number) {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return
  const prev = getSavedOrders().filter((o) => o.code !== normalized)
  const next = [{ code: normalized, total, savedAt: Date.now() }, ...prev].slice(0, 20)
  writeJson(ORDERS_KEY, next)
  ordersSnap = next
  ordersRaw = JSON.stringify(next)
}

export function getSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (sessionSnap !== undefined && sessionRaw === raw) return sessionSnap
  try {
    const s = raw ? (JSON.parse(raw) as CustomerSession) : null
    sessionSnap = s?.email ? s : null
  } catch {
    sessionSnap = null
  }
  sessionRaw = raw
  return sessionSnap
}

export function setSession(session: CustomerSession | null) {
  if (!session) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_KEY)
      sessionSnap = null
      sessionRaw = null
      window.dispatchEvent(new CustomEvent('techstore:customer-changed', { detail: { key: SESSION_KEY } }))
    }
    return
  }
  writeJson(SESSION_KEY, session)
  sessionSnap = session
  sessionRaw = JSON.stringify(session)
}

export function loginLocal(email: string, displayName: string): CustomerSession {
  const session: CustomerSession = {
    email: email.trim().toLowerCase(),
    displayName: displayName.trim() || email.split('@')[0] || 'Khách',
    loggedInAt: Date.now(),
  }
  setSession(session)
  saveProfile({ email: session.email, fullName: session.displayName })
  return session
}

export function logoutLocal() {
  setSession(null)
}

export function subscribeCustomer(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('techstore:customer-changed', onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener('techstore:customer-changed', onChange)
    window.removeEventListener('storage', onChange)
  }
}
