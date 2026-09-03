import { NextResponse } from 'next/server'
import { z } from 'zod'

import { runAssistantTurn, type ChatMessage } from '@/lib/assistant/agent'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1000),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(10),
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

  const result = await runAssistantTurn(history)
  return NextResponse.json({
    reply: result.reply,
    cards: result.cards,
    suggestions: result.suggestions,
    disabled: result.disabled ?? false,
  })
}
