import { describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/v1/assistant/merchant/approve/route'

vi.mock('@/lib/admin/auth', () => ({
  requireAdminSession: vi.fn(async (module?: string) => {
    if (module === 'products') return { role: 'admin', userId: 'u1' }
    throw new Error('FORBIDDEN')
  }),
}))

const signed = {
  change: {
    id: 'chg-1',
    kind: 'publish',
    summary: 'Xuất bản 1 sản phẩm',
    note: null,
    action: { kind: 'publish', target: 'publish', productIds: ['p1'] },
    items: [{ productId: 'p1', name: 'Laptop A', before: 'Bản nháp', after: 'Đã xuất bản' }],
    createdAt: new Date().toISOString(),
  },
  signature: 'a'.repeat(64),
}

vi.mock('@/lib/assistant/merchant/ledger', () => ({
  recordStaged: vi.fn(async () => {}),
  listPendingStaged: vi.fn(async () => []),
  getStagedById: vi.fn(async (id: string) => (id === 'chg-1' ? signed : null)),
  getStagedDecisionMeta: decisionMetaMock,
  markStagedDecided: vi.fn(async () => {}),
}))

const decisionMetaMock = vi.hoisted(() =>
  vi.fn(async (id: string) =>
    id === 'chg-1'
      ? { status: 'staged', createdBy: 'u2', expiresAt: new Date(Date.now() + 3600_000).toISOString() }
      : null,
  ),
)

vi.mock('@/lib/assistant/merchant/stage', () => ({
  applySignedChange: vi.fn(async () => ({ ok: true, message: 'Đã xuất bản 1 sản phẩm.' })),
}))

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/v1/assistant/merchant/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('merchant approve endpoint', () => {
  it('applies a staged change by id', async () => {
    const res = await post({ changeId: 'chg-1', decision: 'apply' })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean }
    expect(data.ok).toBe(true)
  })

  it('discards without executing', async () => {
    const res = await post({ changeId: 'chg-1', decision: 'discard' })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean; message: string }
    expect(data.ok).toBe(true)
    expect(data.message).toMatch(/bỏ/)
  })

  it('404s unknown change ids', async () => {
    const res = await post({ changeId: 'chg-nope', decision: 'apply' })
    expect(res.status).toBe(404)
  })

  it('rejects malformed bodies', async () => {
    const res = await post({ changeId: 'chg-1' })
    expect(res.status).toBe(400)
  })

  it('blocks self-approval (separation of duties)', async () => {
    decisionMetaMock.mockResolvedValueOnce({
      status: 'staged',
      createdBy: 'u1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    const res = await post({ changeId: 'chg-1', decision: 'apply' })
    expect(res.status).toBe(403)
    const data = (await res.json()) as { code: string }
    expect(data.code).toBe('SELF_APPROVAL')
  })

  it('expires staged changes after 24h', async () => {
    decisionMetaMock.mockResolvedValueOnce({
      status: 'staged',
      createdBy: 'u2',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    const res = await post({ changeId: 'chg-1', decision: 'apply' })
    expect(res.status).toBe(410)
    const data = (await res.json()) as { code: string }
    expect(data.code).toBe('EXPIRED')
  })
})
