import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { GET } from '@/app/api/health/route'

/**
 * Q16/Q97 — ?check=config exposes booleans only (never secret values), so a
 * deploy missing required env is visible in one monitored call.
 */
describe('health config check', () => {
  it('returns presence booleans without leaking values', async () => {
    const response = await GET(new NextRequest('http://localhost/api/health?check=config'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.config).toMatchObject({
      supabase: expect.any(Boolean),
      serviceRole: expect.any(Boolean),
      siteUrl: expect.any(Boolean),
      siteUrlFallbackLocalhost: expect.any(Boolean),
      tokenPepper: expect.any(Boolean),
      cronSecret: expect.any(Boolean),
      stagingSecret: expect.any(Boolean),
      vnpayLive: expect.any(Boolean),
    })
    const serialized = JSON.stringify(body)
    expect(serialized.length).toBeLessThan(2000)
  })
})
