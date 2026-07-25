import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

const ADMIN_COOKIE = 'techstore_admin'

/**
 * Edge-safe HMAC verification matching lib/admin/auth.ts token format:
 * `${exp}.${nonce}.${hmacBase64url}` where hmac = HMAC-SHA256(secret, exp.nonce)
 */
async function verifyAdminToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || secret.length < 16) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expRaw, nonce, mac] = parts
  if (!expRaw || !nonce || !mac) return false
  if (!/^\d+$/.test(expRaw)) return false
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false

  const body = `${expRaw}.${nonce}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expected = base64Url(new Uint8Array(sig))
  return timingSafeEqual(mac, expected)
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Refresh customer Supabase session for storefront + auth routes.
  if (!pathname.startsWith('/admin')) {
    return updateSession(request)
  }

  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next()
  }

  const secret = process.env.ADMIN_SECRET
  if (!secret || secret.length < 16) {
    const login = new URL('/admin/login', request.url)
    login.searchParams.set('error', 'config')
    return NextResponse.redirect(login)
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value
  const ok = await verifyAdminToken(token, secret)
  if (!ok) {
    const login = new URL('/admin/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Refresh customer session + guard admin.
     * Skip Next internals and static assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
