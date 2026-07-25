import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'techstore_admin'
const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours

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
  const jar = await cookies()
  return verifyAdminSessionToken(jar.get(ADMIN_COOKIE)?.value)
}

export async function requireAdminSession(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    throw new Error('UNAUTHORIZED')
  }
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
