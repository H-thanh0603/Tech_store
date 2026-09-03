import { timingSafeEqual } from 'node:crypto'

export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const received = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}
