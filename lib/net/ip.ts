/**
 * Trusted client-IP resolution (H1 rate-limit spoof fix).
 *
 * Trust order:
 *   1. `x-real-ip` — set/overwritten by the edge platform (Vercel). Clients
 *      cannot spoof it when the platform overwrites it on ingress.
 *   2. First entry of `x-forwarded-for` — the original-client slot as seen by
 *      the first trusted proxy. We deliberately do NOT use the last hop
 *      (previous code used `.at(-1)`): with an append-style proxy the last
 *      slot is the most attacker-influenced when the edge does not strip it,
 *      and rotating it reset every IP-keyed bucket.
 *   3. Explicit fallback (test harness) → 'unknown'.
 *
 * Only the first valid IPv4/IPv6-ish token is accepted; garbage collapses to
 * 'unknown' so one header cannot mint unlimited identities.
 */

const IP_LIKE = /^[0-9a-fA-F:.]{3,45}$/

function clean(token: string | undefined | null): string | null {
  if (!token) return null
  const t = token.trim()
  if (!t || t === 'unknown') return null
  if (!IP_LIKE.test(t)) return null
  // Basic IPv4 shape check; IPv6 passes through on charset alone.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(t)) {
    const octets = t.split('.').map(Number)
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  }
  return t
}

export function trustedClientIp(
  headerList: Pick<Headers, 'get'>,
  fallback?: string | null,
): string {
  const real = clean(headerList.get('x-real-ip'))
  if (real) return real

  const xff = headerList.get('x-forwarded-for')
  if (xff) {
    // Leftmost = original client per de-facto XFF convention; also take the
    // first *valid* token so a leading garbage entry cannot evade limits.
    for (const part of xff.split(',')) {
      const ip = clean(part)
      if (ip) return ip
    }
  }

  if (fallback) {
    for (const part of fallback.split(',')) {
      const ip = clean(part)
      if (ip) return ip
    }
  }
  return 'unknown'
}

/** Back-compat alias — prefer trustedClientIp in new code. */
export const clientIpFromHeaders = trustedClientIp
