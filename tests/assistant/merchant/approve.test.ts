import { describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/v1/assistant/merchant/approve/route'

vi.mock('@/lib/admin/auth', () => ({
  requireAdminSession: vi.fn(async (module?: string) => {
    if (module === 'products') return { role: 'admin', userId: 'u1' }
    throw new Error('FORBIDDEN')
  }),
}))

vi.mock('@/lib/assistant/merchant/stage', () => ({
  applySignedChange: vi.fn(async () => ({ ok: true, message: 'Đã xuất bản 1 sản phẩm.' })),
}))

function validBody() {
  return {
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
}

describe('merchant approve endpoint', () => {
  it('applies a valid signed change for authorized staff', async () => {
    const res = await POST(
      new Request('http://localhost/api/v1/assistant/merchant/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody()),
      }),
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean }
    expect(data.ok).toBe(true)
  })

  it('rejects malformed envelopes', async () => {
    const res = await POST(
      new Request('http://localhost/api/v1/assistant/merchant/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ change: { kind: 'nuke' }, signature: 'short' }),
      }),
    )
    expect(res.status).toBe(400)
  })
})
