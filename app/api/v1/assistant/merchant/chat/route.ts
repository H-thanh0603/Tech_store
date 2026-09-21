import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAgentActivity } from '@/lib/assistant/activity-log'
import { requireAdminSession } from '@/lib/admin/auth'
import type { ChatMessage } from '@/lib/assistant/agent'
import { ABUSE_BAN_MESSAGE, isBanned, recordViolation } from '@/lib/assistant/abuse'
import { runMerchantTurn, streamMerchantTurn } from '@/lib/assistant/merchant/agent'
import { detectJailbreak, MERCHANT_JAILBREAK_REFUSAL, scanTranscript } from '@/lib/assistant/jailbreak'
import { resolveMerchantScope } from '@/lib/assistant/jev'
import { clientIp, isChatDailyLimited, isChatRateLimited } from '@/lib/assistant/rate-limit'
import {
  checkMerchantScope,
  MERCHANT_SCOPE_REFUSAL,
  MERCHANT_SCOPE_SUGGESTIONS,
} from '@/lib/assistant/scope'
import { hashToken } from '@/lib/commerce/tokens'
import { streamToSSE } from '@/lib/assistant/sse'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1000),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(10),
  stream: z.boolean().optional(),
})

/**
 * Merchant assistant chat (staff-only, MFA-verified). Stateless: the admin UI
 * sends recent history each turn. Staged changes return as signed envelopes
 * for the approval buttons — the model can never apply.
 */
export async function POST(request: Request) {
  let session
  try {
    session = await requireAdminSession('assistant')
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

  // Per-staff budget: 60 turns / 15 min + 600 / day (fail-open on limiter outage).
  const identity = `staff:${session.userId}:${clientIp(request.headers)}`
  if (await isChatRateLimited('merchant_chat', identity)) {
    return NextResponse.json(
      {
        code: 'RATE_LIMITED',
        message: 'Bạn thao tác hơi nhanh — nghỉ ít phút rồi tiếp tục nhé.',
        reply: 'Bạn thao tác hơi nhanh — nghỉ ít phút rồi tiếp tục nhé.',
        staged: [],
        suggestions: [],
      },
      { status: 429 },
    )
  }
  if (await isChatDailyLimited('merchant_chat', identity)) {
    return NextResponse.json(
      {
        code: 'DAILY_LIMITED',
        message: 'Bạn đã dùng hết lượt trợ lý hôm nay — quay lại ngày mai nhé.',
        reply: 'Bạn đã dùng hết lượt trợ lý hôm nay — quay lại ngày mai nhé.',
        staged: [],
        suggestions: [],
      },
      { status: 429 },
    )
  }

  // Abuse layer (no model call burned): active ban → jailbreak detector
  // (logged, feeds the ban ladder) → hard scope gate.
  const banHash = await hashToken(`merchant_chat:${session.userId}:${clientIp(request.headers)}`)
  if (await isBanned(banHash)) {
    return NextResponse.json(
      {
        code: 'BANNED',
        message: ABUSE_BAN_MESSAGE,
        reply: ABUSE_BAN_MESSAGE,
        staged: [],
        suggestions: [],
      },
      { status: 403 },
    )
  }
  const lastText = [...parsed.data.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  // H4: full-transcript scan (same rationale as the shopping endpoint).
  const jailbreak = scanTranscript(parsed.data.messages) ?? detectJailbreak(lastText)
  if (jailbreak) {
    const evidence = [...parsed.data.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    await recordViolation(banHash, 'merchant_chat', `jailbreak:${jailbreak.kind}`, evidence.slice(0, 500))
    return NextResponse.json({
      code: 'BLOCKED',
      reply: MERCHANT_JAILBREAK_REFUSAL,
      staged: [],
      suggestions: MERCHANT_SCOPE_SUGGESTIONS,
    })
  }
  if (checkMerchantScope(lastText) === 'off-topic') {
    return NextResponse.json({
      code: 'OFF_SCOPE',
      reply: MERCHANT_SCOPE_REFUSAL,
      staged: [],
      suggestions: MERCHANT_SCOPE_SUGGESTIONS,
    })
  }
  // Jev semantic triage (fail-open): same pattern as the shopping endpoint.
  try {
    const scoped = await resolveMerchantScope(lastText)
    if (scoped.verdict === 'off-topic' && scoped.source === 'keyword+jev') {
      return NextResponse.json({
        code: 'OFF_SCOPE',
        reply: MERCHANT_SCOPE_REFUSAL,
        staged: [],
        suggestions: MERCHANT_SCOPE_SUGGESTIONS,
      })
    }
  } catch {
    // Fail-open.
  }

  if (parsed.data.stream) {
    return streamToSSE(
      streamMerchantTurn(history, {
        actorUserId: session.userId,
        activity: (call) => {
          void logAgentActivity('merchant', `staff:${session.userId}`, `merchant:${session.userId}`, call)
        },
      }),
    )
  }

  const result = await runMerchantTurn(history, {
    actorUserId: session.userId,
    activity: (call) => {
      void logAgentActivity('merchant', `staff:${session.userId}`, `merchant:${session.userId}`, call)
    },
  })
  return NextResponse.json({
    reply: result.reply,
    staged: result.staged,
    suggestions: result.suggestions,
    disabled: result.disabled ?? false,
    tool_filter: result.toolFilter ?? null,
  })
}
