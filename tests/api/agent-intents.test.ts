import { beforeEach, describe, expect, it, vi } from 'vitest'

function chainable(result: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  chain.single = vi.fn(async () => result)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  return chain
}

let fromImpl: (table: string) => unknown = () => chainable({ data: null, error: null })
const rpc = vi.fn()

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: () => ({ from: (t: string) => fromImpl(t), rpc }),
}))

const { getProductBySlug } = vi.hoisted(() => ({ getProductBySlug: vi.fn() }))
vi.mock('@/lib/catalog/queries', () => ({ getProductBySlug }))

const { verifyAgentToken } = await import('@/lib/agents/tokens')
const { POST } = await import('@/app/api/agents/intents/route')

const detail = {
  id: 'p1',
  name: 'Laptop A',
  slug: 'laptop-a',
  description: null,
  categoryId: 'c1',
  categorySlug: 'laptop',
  categoryName: 'Laptop',
  brandName: 'Dell',
  isFeatured: false,
  images: [],
  variants: [
    {
      id: 'v1',
      sku: 'A-1',
      attributes: {},
      regularPrice: 15000000,
      salePrice: null,
      price: 15000000,
      hasDiscount: false,
      availableStock: 2,
      inStock: true,
    },
  ],
  specs: [],
  useCases: [],
  minPrice: 15000000,
  hasDiscount: false,
  availableStock: 2,
  inStock: true,
}

function tokenRow(overrides = {}) {
  return {
    data: { id: 'tok-1', name: 'test-agent', scopes: ['cart:write'], is_active: true, ...overrides },
    error: null,
  }
}

function post(body: unknown, auth = 'Bearer tsa_test') {
  return POST(
    new Request('http://localhost/api/agents/intents', {
      method: 'POST',
      headers: auth ? { authorization: auth } : {},
      body: JSON.stringify(body),
    }),
  )
}

describe('verifyAgentToken', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: false })
    fromImpl = () => chainable({ data: null, error: null })
  })

  it('rejects missing and non-agent bearers', async () => {
    expect((await verifyAgentToken(null, 'cart:write'))).toMatchObject({ ok: false, error: 'MISSING' })
    expect((await verifyAgentToken('Bearer abc123', 'cart:write'))).toMatchObject({
      ok: false,
      error: 'MISSING',
    })
  })

  it('rejects unknown tokens fail-closed', async () => {
    expect(await verifyAgentToken('Bearer tsa_nope', 'cart:write')).toMatchObject({
      ok: false,
      error: 'INVALID',
    })
  })

  it('rejects inactive tokens and wrong scopes', async () => {
    fromImpl = () => chainable(tokenRow({ is_active: false }))
    expect(await verifyAgentToken('Bearer tsa_x', 'cart:write')).toMatchObject({
      ok: false,
      error: 'INACTIVE',
    })
    fromImpl = () => chainable(tokenRow({ scopes: [] }))
    expect(await verifyAgentToken('Bearer tsa_x', 'cart:write')).toMatchObject({
      ok: false,
      error: 'FORBIDDEN',
    })
  })

  it('enforces the per-token intents bucket', async () => {
    fromImpl = () => chainable(tokenRow())
    rpc.mockResolvedValueOnce({ data: true })
    expect(await verifyAgentToken('Bearer tsa_x', 'cart:write')).toMatchObject({
      ok: false,
      error: 'RATE_LIMITED',
    })
    expect(rpc).toHaveBeenCalledWith(
      'check_rate_limit',
      expect.objectContaining({ p_action: 'agents_intents', p_identity: 'tok-1' }),
    )
  })
})

describe('POST /api/agents/intents', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: false })
    getProductBySlug.mockReset()
    fromImpl = (table: string) => {
      if (table === 'agent_tokens') return chainable(tokenRow())
      if (table === 'agent_order_intents')
        return chainable({ data: { id: 'int-1', expires_at: '2026-09-12T10:00:00Z' }, error: null })
      return chainable({ data: null, error: null })
    }
  })

  it('requires a bearer token', async () => {
    const res = await post({ items: [] }, '')
    expect(res.status).toBe(401)
  })

  it('validates the items envelope', async () => {
    expect((await post({ items: [] })).status).toBe(400)
    expect((await post({ items: [{ slug: 'a', sku: 'b', quantity: 100 }] })).status).toBe(400)
    expect((await post({ nope: true })).status).toBe(400)
  })

  it('refuses unknown slug/sku without creating anything', async () => {
    getProductBySlug.mockResolvedValue(null)
    const res = await post({ items: [{ slug: 'ghost', sku: 'G-1', quantity: 1 }] })
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.unknown).toEqual([{ slug: 'ghost', sku: 'G-1' }])
  })

  it('creates an intent with an approval URL and audit trail', async () => {
    getProductBySlug.mockResolvedValue(detail)
    const res = await post({ items: [{ slug: 'laptop-a', sku: 'A-1', quantity: 2 }] })
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.intentId).toBe('int-1')
    expect(body.approvalUrl).toMatch(/\/intent\//)
    expect(body.items[0]).toMatchObject({ slug: 'laptop-a', price: 15000000, quantity: 2 })
    expect(body.items[0]).not.toHaveProperty('variantId')
    expect(body.note).toMatch(/chưa/i)
  })
})
