import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdminSession } from '@/lib/admin/auth'
import type { ChatMessage } from '@/lib/assistant/agent'
import { runMerchantTurn } from '@/lib/assistant/merchant/agent'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1000),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(10),
})

/**
 * Merchant assistant chat (staff-only, MFA-verified). Stateless: the admin UI
 * sends recent history each turn. Staged changes return as signed envelopes
 * for the approval buttons — the model can never apply.
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession('assistant')
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Cần quyền trợ lý vận hành.' }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Body phải là JSON.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success || !parsed.data.messages.some((m) => m.role === 'user')) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Tin nhắn không hợp lệ.' }, { status: 400 })
  }

  const history: ChatMessage[] = parsed.data.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
  const result = await runMerchantTurn(history)
  return NextResponse.json({
    reply: result.reply,
    staged: result.staged,
    suggestions: result.suggestions,
    disabled: result.disabled ?? false,
  })
}
