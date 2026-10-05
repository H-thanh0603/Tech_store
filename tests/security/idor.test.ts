import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Q120 — IDOR/BOLA: cross-user reads must fail closed. The order code alone
 * is never enough; the per-order access token (cookie) is required and only
 * its hash leaves the server.
 */

const rpc = vi.fn()
let cookieJar: Record<string, string> = {}

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: () => ({ rpc }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar[name] ? { value: cookieJar[name] } : undefined),
    set: vi.fn(),
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { ORDER_ACCESS_COOKIE } from '@/lib/commerce/cookies'
import { getOrderByAccess } from '@/lib/commerce/queries'

describe('order access isolation (IDOR)', () => {
  beforeEach(() => {
    rpc.mockReset()
    cookieJar = {}
  })

  it('user A cannot read user B order by code alone (no cookie → null, no RPC)', async () => {
    const result = await getOrderByAccess('TS-ABC123')

    expect(result).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sends only the token hash, never the raw access token', async () => {
    cookieJar[ORDER_ACCESS_COOKIE] = 'raw-secret-token'
    rpc.mockResolvedValue({ data: { code: 'OK', items: [] }, error: null })

    await getOrderByAccess('TS-ABC123')

    expect(rpc).toHaveBeenCalledWith(
      'order_get_by_access',
      expect.objectContaining({
        p_order_code: 'TS-ABC123',
        p_access_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    )
    const sent = rpc.mock.calls[0][1] as Record<string, string>
    expect(JSON.stringify(sent)).not.toContain('raw-secret-token')
  })

  it('wrong token yields null (no partial data leak)', async () => {
    cookieJar[ORDER_ACCESS_COOKIE] = 'attacker-token'
    rpc.mockResolvedValue({ data: { code: 'FORBIDDEN' }, error: null })

    await expect(getOrderByAccess('TS-ABC123')).resolves.toBeNull()
  })

  it('DB errors fail closed, not open', async () => {
    cookieJar[ORDER_ACCESS_COOKIE] = 'some-token'
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await expect(getOrderByAccess('TS-ABC123')).resolves.toBeNull()
  })
})
