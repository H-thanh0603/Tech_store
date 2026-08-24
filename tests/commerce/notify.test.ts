import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const row = {
  id: 'd1000000-0000-0000-0000-000000000001',
  type: 'order_confirmation',
  payload: {
    email: 'buyer@example.com',
    customerName: 'Buyer',
    orderCode: 'TS-NOTIFY-001',
    total: 1000,
  },
  retry_count: 0,
}

const rpc = vi.fn(async () => ({ data: [row], error: null }))
const finalEq = vi.fn(async () => ({ error: null }))
const update = vi.fn(() => ({
  eq: vi.fn(() => ({ eq: finalEq })),
}))
const limit = vi.fn(async () => ({ data: [row], error: null }))
const select = vi.fn(() => ({
  eq: vi.fn(() => ({
    or: vi.fn(() => ({
      order: vi.fn(() => ({ limit })),
    })),
  })),
}))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ rpc, from: () => ({ select, update }) }),
}))
vi.mock('@/lib/site', () => ({ getSiteUrl: () => 'https://techstore.test' }))

import { processPendingNotifications } from '@/lib/commerce/notify'

describe('processPendingNotifications', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key'
    rpc.mockClear()
    finalEq.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '' })))
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
    vi.unstubAllGlobals()
  })

  it('claims a row before sending and gives the provider a stable idempotency key', async () => {
    const result = await processPendingNotifications(1)

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 })
    expect(rpc).toHaveBeenCalledWith('claim_notification_outbox', expect.objectContaining({ p_limit: 1 }))
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': `notification/${row.id}` }),
      }),
    )
  })

  it('escapes customer-controlled values before building email HTML', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        ...row,
        payload: {
          ...row.payload,
          customerName: '</p><img src=x onerror=alert(1)>',
        },
      }],
      error: null,
    })

    await processPendingNotifications(1)

    const fetchMock = vi.mocked(fetch)
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as { html: string }
    expect(body.html).not.toContain('<img')
    expect(body.html).toContain('&lt;img')
  })
})
