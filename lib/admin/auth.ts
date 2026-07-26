import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'

import {
  canAccessModule,
  DEFAULT_ADMIN_ROLE,
  isAdminRole,
  type AdminModule,
  type AdminRole,
} from '@/lib/admin/permissions'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export const ADMIN_COOKIE = 'techstore_admin'
const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours

export type AdminAuthMode = 'supabase' | 'legacy-secret'

export type AdminSession = {
  userId: string | null
  role: AdminRole
  actorLabel: string
}

export function adminAuthMode(): AdminAuthMode {
  if (process.env.NODE_ENV === 'production') return 'supabase'
  if (process.env.ADMIN_AUTH_MODE === 'legacy-secret') return 'legacy-secret'
  if (process.env.ADMIN_AUTH_MODE === 'supabase') return 'supabase'
  return 'legacy-secret'
}

function requireAdminSecret(): string {
  const secret = process.env.ADMIN_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('Missing or weak ADMIN_SECRET (min 16 chars)')
  }
  return secret
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createAdminSessionToken(now = Date.now()): string {
  const secret = requireAdminSecret()
  const exp = Math.floor(now / 1000) + SESSION_TTL_SECONDS
  const nonce = randomBytes(16).toString('base64url')
  const body = `${exp}.${nonce}`
  return `${body}.${sign(body, secret)}`
}

export function verifyAdminSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): boolean {
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret || secret.length < 16) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expRaw, nonce, mac] = parts
  if (!expRaw || !nonce || !mac) return false
  if (!/^\d+$/.test(expRaw)) return false

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 < now) return false

  const body = `${expRaw}.${nonce}`
  const expected = sign(body, secret)
  try {
    const a = Buffer.from(mac)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Still run a compare to reduce timing oracles on length-only paths.
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  return timingSafeEqual(a, b)
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return Boolean(await getAdminSession())
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (adminAuthMode() === 'legacy-secret') {
    const jar = await cookies()
    return verifyAdminSessionToken(jar.get(ADMIN_COOKIE)?.value)
      ? { userId: null, role: DEFAULT_ADMIN_ROLE, actorLabel: 'legacy-admin' }
      : null
  }

  const supabase = await createSupabaseAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('admin_users')
    .select('display_name, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data || !isAdminRole(data.role)) return null

  return {
    userId: user.id,
    role: data.role,
    actorLabel: data.display_name || user.email || user.id,
  }
}

export async function requireAdminSession(module?: AdminModule): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new Error('UNAUTHORIZED')
  if (module && !canAccessModule(session.role, module)) throw new Error('FORBIDDEN')
  return session
}

export function adminCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}
