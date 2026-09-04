import { describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/v1/assistant/chat/route'
import { clientIp, isChatRateLimited } from '@/lib/assistant/rate-limit'

const rpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: () => ({ rpc }),
}))

vi.mock('@/lib/assistant/agent', () => ({
  runAssistantTurn: vi.fn(async () => ({ reply: 'hi', cards: [], suggestions: [] })),
}))

function headersWithIp(ip: string): Headers {
  return new Headers({ 'x-forwarded-for': `1.1.1.1, ${ip}` })
}

describe('assistant rate limit', () => {
  it('extracts the last forwarded hop as client ip', () => {
    expect(clientIp(headersWithIp('9.9.9.9'))).toBe('9.9.9.9')
  })

  it('blocks when the RPC says so, fails open on error', async () => {
    rpc.mockResolvedValueOnce({ data: true })
    expect(await isChatRateLimited('assistant_chat', '9.9.9.9')).toBe(true)
    rpc.mockRejectedValueOnce(new Error('db down'))
    expect(await isChatRateLimited('assistant_chat', '9.9.9.9')).toBe(false)
  })

  it('returns 429 without calling the model when limited', async () => {
    const { runAssistantTurn } = await import('@/lib/assistant/agent')
    rpc.mockResolvedValueOnce({ data: true })
    const res = await POST(
      new Request('http://localhost/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      }),
    )
    expect(res.status).toBe(429)
    expect(runAssistantTurn).not.toHaveBeenCalled()
  })
})
