import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const setCookie = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: () => ({ rpc }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: setCookie }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addToCart } from '@/lib/commerce/actions'

function itemForm(quantity: string): FormData {
  const form = new FormData()
  form.set('variantId', '40000000-0000-0000-0000-000000000001')
  form.set('quantity', quantity)
  return form
}

describe('addToCart', () => {
  beforeEach(() => {
    rpc.mockReset()
    setCookie.mockReset()
  })

  it('creates a cart cookie before calling cart_add_item with its hash', async () => {
    rpc.mockResolvedValue({ data: { code: 'OK' }, error: null })

    await addToCart({ ok: true }, itemForm('1'))

    expect(setCookie).toHaveBeenCalledWith(
      'techstore_cart',
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    )
    expect(rpc).toHaveBeenCalledWith(
      'cart_add_item',
      expect.objectContaining({
        p_cart_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_variant_id: '40000000-0000-0000-0000-000000000001',
        p_quantity: 1,
      }),
    )
  })

  it('maps OUT_OF_STOCK to a safe user message', async () => {
    rpc.mockResolvedValue({ data: { code: 'OUT_OF_STOCK', available: 0 }, error: null })

    const result = await addToCart({ ok: true }, itemForm('1'))

    expect(result).toMatchObject({ ok: false, code: 'OUT_OF_STOCK' })
    expect(result.message).not.toMatch(/select|postgres|relation/i)
  })

  it.each(['0', '100'])('rejects quantity %s before RPC', async (quantity) => {
    const result = await addToCart({ ok: true }, itemForm(quantity))

    expect(result.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})
