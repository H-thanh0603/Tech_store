import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('returns ok payload with no-store cache', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('techstore')
    expect(typeof body.timestamp).toBe('string')
  })

  it('reports db status when ?check=db is set', async () => {
    const req = new NextRequest(new URL('http://localhost/api/health?check=db'))
    const res = await GET(req)
    const body = await res.json()
    expect(['ok', 'unreachable', 'misconfigured']).toContain(body.db)
    expect([200, 503]).toContain(res.status)
    if (body.db === 'ok') {
      expect(typeof body.latencyMs).toBe('number')
    }
  })
})
