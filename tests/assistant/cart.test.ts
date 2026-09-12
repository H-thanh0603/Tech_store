import { describe, expect, it, vi } from 'vitest'

import {
  chatAddToCart,
  chatCheckoutHandoff,
  chatRemoveFromCart,
  chatUpdateCartItem,
  ensureCartToken,
  getChatCart,
  parseCartToken,
  validateQuantity,
  type CartRpcClient,
} from '@/lib/assistant/cart'
import { createDispatchContext, dispatchTool, TOOL_ADD_TO_CART } from '@/lib/assistant/tools'

const detail = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  description: '',
  categoryId: 'c1',
  categorySlug: 'dien-thoai',
  categoryName: 'Điện thoại',
  brandName: 'Apple',
  isFeatured: false,
  images: [],
  variants: [
    { id: 'var-1', sku: 'IP15', attributes: {}, price: 20000000, salePrice: null, inStock: true, availableStock: 5 },
  ],
  specs: [],
  useCases: [],
  minPrice: 20000000,
  hasDiscount: false,
  availableStock: 5,
  inStock: true,
}

vi.mock('@/lib/catalog/queries', () => ({
  getProducts: vi.fn(async () => ({ products: [], total: 0, page: 1, pageSize: 12, pageCount: 0 })),
  getProductBySlug: vi.fn(async (slug: string) => (slug === 'iphone-15' ? detail : null)),
}))

vi.mock('@/lib/admin/supabase', () => ({
  getSupabaseAdminClient: vi.fn(() => {
    throw new Error('not used here')
  }),
}))

function fakeRpc(cart = { itemCount: 1, subtotal: 20000000, items: [] }): CartRpcClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    rpc: async (name: string) => {
      calls.push(name)
      if (name === 'cart_get') return { data: cart, error: null }
      return { data: { code: 'OK' }, error: null }
    },
  }
}

describe('cart cookie helpers', () => {
  it('parses the cart token and mints when missing', () => {
    expect(parseCartToken('a=1; techstore_cart=tok123; b=2')).toBe('tok123')
    expect(parseCartToken(null)).toBeNull()
    expect(ensureCartToken('x')).toEqual({ token: 'x', isNew: false })
    expect(ensureCartToken(null).isNew).toBe(true)
  })

  it('validates quantities against caps and stock', () => {
    expect(validateQuantity(2, 5)).toBeNull()
    expect(validateQuantity(0, 5)).toContain('1–10')
    expect(validateQuantity(11, 99)).toContain('1–10')
    expect(validateQuantity(6, 5)).toContain('5')
  })
})

describe('chat cart writes', () => {
  it('adds a single-variant product by slug', async () => {
    const rpc = fakeRpc()
    const result = await chatAddToCart('hash', 'iphone-15', 2, new Map(), rpc)
    expect(result.ok).toBe(true)
    expect(rpc.calls).toContain('cart_add_item')
  })

  it('rejects unseen opaque ids and over-stock quantities', async () => {
    const rpc = fakeRpc()
    const unseen = await chatAddToCart('hash', '123e4567-e89b-12d3-a456-426614174000', 1, new Map(), rpc)
    expect(unseen.ok).toBe(false)
    expect(rpc.calls).not.toContain('cart_add_item')

    const over = await chatAddToCart('hash', 'iphone-15', 9, new Map(), rpc)
    expect(over.ok).toBe(false)
  })

  it('updates and removes through dispatch with a seen variant id', async () => {
    const rpc = fakeRpc()
    const ctx = createDispatchContext({ cartTokenHash: 'hash', cartRpc: rpc })
    ctx.seenIds.set('var-1', 'iphone-15')
    const updated = await dispatchTool(ctx, TOOL_ADD_TO_CART, { identifier: 'var-1', quantity: 1 })
    expect(updated).toContain('"result":"ok"')
    const removed = await chatRemoveFromCart('hash', 'var-1', ctx.seenIds, rpc)
    expect(removed.ok).toBe(true)
    const changed = await chatUpdateCartItem('hash', 'var-1', 3, ctx.seenIds, rpc)
    expect(changed.ok).toBe(true)
  })

  it('reads an empty cart view on RPC failure', async () => {
    const rpc: CartRpcClient = { rpc: async () => ({ data: null, error: new Error('down') }) }
    expect(await getChatCart('hash', rpc)).toEqual({ item_count: 0, subtotal: 0, items: [] })
  })
})

describe('checkout handoff', () => {
  it('requires explicit confirmation and a non-empty cart', async () => {
    const rpc = fakeRpc()
    const unconfirmed = await chatCheckoutHandoff('hash', false, rpc)
    expect(unconfirmed.handoff).toBeNull()

    const ok = await chatCheckoutHandoff('hash', true, rpc)
    expect(ok.handoff?.checkout_url).toBe('/checkout')
    expect(ok.handoff?.subtotal).toBe(20000000)

    const empty: CartRpcClient = {
      rpc: async () => ({ data: { itemCount: 0, subtotal: 0, items: [] }, error: null }),
    }
    const none = await chatCheckoutHandoff('hash', true, empty)
    expect(none.handoff).toBeNull()
  })
})
