import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const row: { id: string; type: string; payload: Record<string, unknown>; retry_count: number } = {
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

import { processPendingNotifications, _resetNotifyBreakerForTests } from '@/lib/commerce/notify'

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

  it('sends a distinct urgent subject for the second abandoned-cart touch', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        ...row,
        type: 'abandoned_cart',
        payload: { ...row.payload, email: 'forget@example.com', itemCount: 3, reminder: 2 },
      }],
      error: null,
    })

    const result = await processPendingNotifications(1)

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 })
    const fetchMock = vi.mocked(fetch)
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as { subject: string; html: string }
    expect(body.subject).toContain('Sắp hết hàng')
    expect(body.html).toContain('số lượng có hạn')
    _resetNotifyBreakerForTests()
  })

  it('trips the circuit breaker after consecutive provider failures (Q88)', async () => {
    _resetNotifyBreakerForTests()
    vi.mocked(fetch).mockResolvedValue({ ok: false, text: async () => 'down' } as Response)

    const rows = Array.from({ length: 7 }, (_, i) => ({
      ...row,
      id: `d1000000-0000-0000-0000-00000000000${i}`,
    }))
    rpc.mockResolvedValueOnce({ data: rows, error: null })

    const result = await processPendingNotifications(20)

    // 5 rows attempted (breaker trips), the rest stay pending for next run.
    expect(result).toEqual({ sent: 0, failed: 5, skipped: 0 })
    expect(fetch).toHaveBeenCalledTimes(5)
    _resetNotifyBreakerForTests()
  })
})
