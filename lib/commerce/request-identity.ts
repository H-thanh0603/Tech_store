import { trustedClientIp } from '@/lib/net/ip'

export function getRateLimitIdentity(requestHeaders: Pick<Headers, 'get'>, sessionHash: string) {
  // Platform-trusted IP (x-real-ip first, leftmost valid XFF second).
  const edgeAddress = trustedClientIp(requestHeaders)

  return `${sessionHash}:${edgeAddress}`
}
