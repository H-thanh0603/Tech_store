import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

describe('GET /api/cron/health', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects unauthenticated callers', async () => {
    process.env.CRON_SECRET = 's3cret'
    const { GET } = await import('@/app/api/cron/health/route')
    const res = await GET(new Request('http://localhost/api/cron/health'))
    expect(res.status).toBe(401)
  })

  it('rejects when CRON_SECRET is not configured even with auth header', async () => {
    delete process.env.CRON_SECRET
    const { GET } = await import('@/app/api/cron/health/route')
    const res = await GET(
      new Request('http://localhost/api/cron/health', {
        headers: { authorization: 'Bearer anything' },
      }),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/CRON_SECRET/)
  })
})
