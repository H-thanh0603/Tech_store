import { describe, expect, it, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/health/route'

afterEach(() => {
  vi.unstubAllEnvs()
})

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

  it('reports jev disabled without a key', async () => {
    vi.stubEnv('JEV_ENABLED', '')
    vi.stubEnv('JEV_API_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const res = await GET()
    const body = await res.json()
    expect(body.jev).toMatchObject({ enabled: false })
  })

  it('reports jev transport and last error when failing', async () => {
    vi.stubEnv('JEV_API_KEY', 'test-key')
    vi.stubEnv('JEV_API', 'chat')
    const { _resetJevWarnForTests, jevDecide, jevLastError } = await import('@/lib/assistant/jev')
    _resetJevWarnForTests()
    const fail = vi.fn(async () => ({ ok: false, status: 403 }) as unknown as Response)
    await jevDecide({ question: 'q?', choices: ['a', 'b'], context: 'hi', fetchFn: fail as unknown as typeof fetch })
    expect(jevLastError()).toContain('403')
    const res = await GET()
    const body = await res.json()
    expect(body.jev).toMatchObject({ enabled: true, api: 'chat', lastError: expect.stringContaining('403') })
    _resetJevWarnForTests()
  })
})
