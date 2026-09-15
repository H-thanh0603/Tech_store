import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn(async () => ({ error: null }))
const rateLimited = vi.fn(async () => ({ data: false }))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ from: () => ({ insert }), rpc: rateLimited }),
}))

import { POST } from '@/app/api/analytics/events/route'

const validEvent = {
  event: 'search_performed',
  payload: { hasSearch: true, searchLength: 8, source: 'header' },
  sessionId: '91000000-0000-4000-8000-000000000099',
  ts: Date.now(),
}

describe('analytics batch endpoint', () => {
  beforeEach(() => {
    insert.mockClear()
    rateLimited.mockClear()
    rateLimited.mockResolvedValue({ data: false })
  })

  it('accepts a bounded PII-free batch', async () => {
    const response = await POST(new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [validEvent] }),
    }))

    expect(response.status).toBe(202)
    expect(insert).toHaveBeenCalledOnce()
  })

  it('rejects payload keys that can contain PII', async () => {
    const response = await POST(new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [{ ...validEvent, payload: { email: 'buyer@example.com' } }] }),
    }))

    expect(response.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns 429 when the per-IP throttle trips', async () => {
    rateLimited.mockResolvedValueOnce({ data: true })
    const response = await POST(new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [validEvent] }),
    }))

    expect(response.status).toBe(429)
    expect(insert).not.toHaveBeenCalled()
  })

  it('fail-opens when the limiter errors', async () => {
    rateLimited.mockRejectedValueOnce(new Error('limiter down'))
    const response = await POST(new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [validEvent] }),
    }))

    expect(response.status).toBe(202)
    expect(insert).toHaveBeenCalledOnce()
  })
})
