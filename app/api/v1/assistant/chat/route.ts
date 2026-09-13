import { NextResponse } from 'next/server'
import { z } from 'zod'

import { runAssistantTurn, streamAssistantTurn, type ChatMessage } from '@/lib/assistant/agent'
import { cartSetCookie, ensureCartToken, parseCartToken } from '@/lib/assistant/cart'
import { assistantConfig } from '@/lib/assistant/config'
import { loadMemoryFacts, sessionKeyHash, updateMemory, updateMemoryWithModel } from '@/lib/assistant/memory'
import { createProviderClient } from '@/lib/assistant/providers'
import { clientIp, isChatRateLimited } from '@/lib/assistant/rate-limit'
import { streamToSSE } from '@/lib/assistant/sse'
import { sha256Hex } from '@/lib/commerce/tokens'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1000),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(10),
  stream: z.boolean().optional(),
  /** Client-generated chat session id (localStorage) for memory. Optional. */
  sessionId: z.string().min(8).max(128).optional(),
})

/**
 * Versioned shopping-assistant endpoint (pilot).
 * Stateless: the client sends the recent history each turn; the server caps
 * length and total size. ANTHROPIC_API_KEY never leaves the server.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Body phải là JSON.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Tin nhắn không hợp lệ.' }, { status: 400 })
  }
  if (!parsed.data.messages.some((m) => m.role === 'user')) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Thiếu tin nhắn của bạn.' }, { status: 400 })
  }

  const history: ChatMessage[] = parsed.data.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // Budget protection: 20 turns / 15 min per IP (fail-open on limiter outage).
  // request.headers (not next/headers) so the route stays unit-testable.
  if (await isChatRateLimited('assistant_chat', clientIp(request.headers))) {
    return NextResponse.json(
      {
        code: 'RATE_LIMITED',
        message: 'Bạn nhắn hơi nhanh — nghỉ ít phút rồi hỏi tiếp nhé.',
        reply: 'Bạn nhắn hơi nhanh — nghỉ ít phút rồi hỏi tiếp nhé.',
        cards: [],
        suggestions: [],
      },
      { status: 429 },
    )
  }

  // The widget shares the storefront guest cart: reuse the browser's cart
  // cookie when present, otherwise mint one and set it on the response so
  // cart tools act on the same cart the website shows.
  const { token: cartToken, isNew: isNewCart } = ensureCartToken(
    parseCartToken(request.headers.get('cookie')),
  )
  const cartTokenHash = await sha256Hex(cartToken)

  // Memory (update_memory after the turn): prefs keyed by the client's
  // session id. Model-driven when ASSISTANT_MEMORY=model (1 extra call),
  // otherwise rule-based. Fail-closed — chat works without it.
  const sessionKey = parsed.data.sessionId ? await sessionKeyHash(parsed.data.sessionId) : null
  const memory = sessionKey ? await loadMemoryFacts(sessionKey) : {}
  const userTexts = history.filter((m) => m.role === 'user').map((m) => m.content)
  const persistMemory = () => {
    if (!sessionKey) return
    if (assistantConfig.enableMemoryExtraction) {
      const client = createProviderClient()
      if (client) {
        void updateMemoryWithModel(sessionKey, userTexts, client, assistantConfig.model).catch(() => {})
        return
      }
    }
    void updateMemory(sessionKey, userTexts).catch(() => {})
  }

  if (parsed.data.stream) {
    persistMemory()
    const streamResponse = streamToSSE(streamAssistantTurn(history, { cartTokenHash, memory }))
    if (isNewCart) streamResponse.headers.set('set-cookie', cartSetCookie(cartToken))
    return streamResponse
  }

  const result = await runAssistantTurn(history, { cartTokenHash, memory })
  persistMemory()
  const response = NextResponse.json({
    reply: result.reply,
    cards: result.cards,
    suggestions: result.suggestions,
    disabled: result.disabled ?? false,
  })
  if (isNewCart) response.headers.set('set-cookie', cartSetCookie(cartToken))
  return response
}