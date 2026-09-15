import { NextResponse } from 'next/server'
import { z } from 'zod'

import type { AgentCallObserver } from '@/lib/assistant/activity'
import { logAgentActivity } from '@/lib/assistant/activity-log'
import { runAssistantTurn, streamAssistantTurn, type ChatMessage } from '@/lib/assistant/agent'
import { ABUSE_BAN_MESSAGE, isBanned, recordViolation } from '@/lib/assistant/abuse'
import { cartSetCookie, ensureCartToken, parseCartToken } from '@/lib/assistant/cart'
import { assistantConfig } from '@/lib/assistant/config'
import { detectJailbreak, JAILBREAK_REFUSAL } from '@/lib/assistant/jailbreak'
import { loadMemoryFacts, sessionKeyHash, updateMemory, updateMemoryWithModel } from '@/lib/assistant/memory'
import { createProviderClient } from '@/lib/assistant/providers'
import { clientIp, isChatDailyLimited, isChatRateLimited } from '@/lib/assistant/rate-limit'
import {
  checkShoppingScope,
  SHOPPING_SCOPE_REFUSAL,
  SHOPPING_SCOPE_SUGGESTIONS,
} from '@/lib/assistant/scope'
import { streamToSSE } from '@/lib/assistant/sse'
import { hashToken } from '@/lib/commerce/tokens'

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
  const ip = clientIp(request.headers)
  if (await isChatRateLimited('assistant_chat', ip)) {
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
  if (await isChatDailyLimited('assistant_chat', ip)) {
    return NextResponse.json(
      {
        code: 'DAILY_LIMITED',
        message: 'Bạn đã dùng hết lượt hỏi hôm nay — quay lại ngày mai nhé.',
        reply: 'Bạn đã dùng hết lượt hỏi hôm nay — quay lại ngày mai nhé.',
        cards: [],
        suggestions: [],
      },
      { status: 429 },
    )
  }

  // Abuse layer (no model call burned): active ban → jailbreak detector
  // (logged, feeds the ban ladder) → hard scope gate.
  const identityHash = await hashToken(`assistant_chat:${ip}`)
  if (await isBanned(identityHash)) {
    return NextResponse.json(
      {
        code: 'BANNED',
        message: ABUSE_BAN_MESSAGE,
        reply: ABUSE_BAN_MESSAGE,
        cards: [],
        suggestions: [],
      },
      { status: 403 },
    )
  }
  const lastText = [...parsed.data.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const jailbreak = detectJailbreak(lastText)
  if (jailbreak) {
    await recordViolation(identityHash, 'assistant_chat', `jailbreak:${jailbreak.kind}`, lastText)
    return NextResponse.json({
      code: 'BLOCKED',
      reply: JAILBREAK_REFUSAL,
      cards: [],
      suggestions: SHOPPING_SCOPE_SUGGESTIONS,
      disabled: false,
    })
  }
  if (checkShoppingScope(lastText) === 'off-topic') {
    return NextResponse.json({
      code: 'OFF_SCOPE',
      reply: SHOPPING_SCOPE_REFUSAL,
      cards: [],
      suggestions: SHOPPING_SCOPE_SUGGESTIONS,
      disabled: false,
    })
  }

  // The widget shares the storefront guest cart: reuse the browser's cart
  // cookie when present, otherwise mint one and set it on the response so
  // cart tools act on the same cart the website shows.
  const { token: cartToken, isNew: isNewCart } = ensureCartToken(
    parseCartToken(request.headers.get('cookie')),
  )
  const cartTokenHash = await hashToken(cartToken)

  // Memory (update_memory after the turn): prefs keyed by the client's
  // session id. Model-driven when ASSISTANT_MEMORY=model (1 extra call),
  // otherwise rule-based. Fail-closed — chat works without it.
  const sessionKey = parsed.data.sessionId ? await sessionKeyHash(parsed.data.sessionId) : null
  const memory = sessionKey ? await loadMemoryFacts(sessionKey) : {}
  const userTexts = history.filter((m) => m.role === 'user').map((m) => m.content)

  // AI Activity Log (audit, fail-open): mỗi tool call của agent vào
  // agent_activity_log; cùng gói dữ liệu đó đang stream ra UI real-time.
  const logSessionKey = sessionKey ?? `ip:${identityHash.slice(0, 24)}`
  const activity: AgentCallObserver = (call) => {
    void logAgentActivity('shopping', logSessionKey, identityHash, call)
  }

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
    const streamResponse = streamToSSE(streamAssistantTurn(history, { cartTokenHash, memory, activity }))
    if (isNewCart) streamResponse.headers.set('set-cookie', cartSetCookie(cartToken))
    return streamResponse
  }

  const result = await runAssistantTurn(history, { cartTokenHash, memory, activity })
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