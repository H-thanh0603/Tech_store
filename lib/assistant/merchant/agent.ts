/**
 * Merchant turn loop (same MessagesClient seam + provider as the shopping
 * pilot). Stateless per request; staged envelopes return to the host UI for
 * approval — the model can never apply.
 */

import type Anthropic from '@anthropic-ai/sdk'

import type { ChatMessage, MessagesClient } from '../agent'
import { createProviderClient, isUnsupportedReasonerModel, REASONER_GUARD_REPLY, resolveProvider } from '../providers'
import { streamTurn, type StreamEvent } from '../stream'
import { merchantConfig, wantsChangeHint, wantsMetricsGrounding } from './config'
import type { SignedChange } from './guardrails'
import { buildMerchantDynamicContext, buildMerchantStaticSystem } from './prompt'
import {
  createMerchantContext,
  buildMerchantTools,
  dispatchMerchantTool,
  TOOL_PRESENT_SUGGESTIONS,
  TOOL_SNAPSHOT,
  type MerchantDispatchContext,
} from './tools'

export interface MerchantTurnResult {
  reply: string
  staged: SignedChange[]
  suggestions: string[]
  disabled?: boolean
}

function lastUserText(history: ChatMessage[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'user') return history[i].content
  }
  return ''
}

const DISABLED_REPLY =
  'Trợ lý vận hành chưa được cấu hình (thiếu API key). Các trang quản trị vẫn dùng bình thường.'

export async function runMerchantTurn(
  history: ChatMessage[],
  deps?: { client?: MessagesClient; now?: Date; actorUserId?: string | null },
): Promise<MerchantTurnResult> {
  const client = deps?.client ?? createProviderClient()
  if (!client) {
    return { reply: DISABLED_REPLY, staged: [], suggestions: [], disabled: true }
  }

  const config = merchantConfig
  if (resolveProvider() === 'deepseek' && isUnsupportedReasonerModel(config.model)) {
    return { reply: REASONER_GUARD_REPLY, staged: [], suggestions: [] }
  }

  const ctx: MerchantDispatchContext = createMerchantContext(deps?.actorUserId ?? null)
  const userText = lastUserText(history)
  const system =
    `${buildMerchantStaticSystem()}\n\n` +
    buildMerchantDynamicContext(deps?.now ?? new Date(), {
      metricsHint: wantsMetricsGrounding(userText),
      changeHint: wantsChangeHint(userText),
    })
  const tools = buildMerchantTools()
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // Metrics grounding gate: a performance question forces one snapshot read first.
  const forcedTool = wantsMetricsGrounding(userText) ? TOOL_SNAPSHOT : null
  const staged: SignedChange[] = []
  const replyParts: string[] = []

  for (let round = 0; round <= config.maxToolIterations; round += 1) {
    const forceText = round === config.maxToolIterations
    const tool_choice: Anthropic.ToolChoice =
      forceText
        ? { type: 'none' }
        : round === 0 && forcedTool
          ? { type: 'tool', name: forcedTool }
          : { type: 'auto' }

    let response
    try {
      response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system,
        tools,
        tool_choice,
        messages,
      })
    } catch {
      return {
        reply: 'Xin lỗi, trợ lý đang bận. Thử lại sau ít phút nhé.',
        staged,
        suggestions: ctx.suggestions,
      }
    }

    const assistantBlocks: Anthropic.ContentBlockParam[] = []
    const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = []
    for (const block of response.content) {
      if (block.type === 'text') {
        if (block.text.trim()) replyParts.push(block.text)
        assistantBlocks.push({ type: 'text', text: block.text })
      } else if (block.type === 'tool_use') {
        toolUses.push({ id: block.id, name: block.name, input: block.input })
        assistantBlocks.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input })
      }
    }
    messages.push({ role: 'assistant', content: assistantBlocks })

    if (toolUses.length === 0 || forceText) break

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of toolUses) {
      const outcome = await dispatchMerchantTool(ctx, use.name, use.input)
      if (outcome.signed) staged.push(outcome.signed)
      results.push({ type: 'tool_result', tool_use_id: use.id, content: outcome.text })
      if (use.name === TOOL_PRESENT_SUGGESTIONS) ctx.endTurn = true
    }
    messages.push({ role: 'user', content: results })
    if (ctx.endTurn) break
  }

  const reply = replyParts.join('\n\n').trim()
  return {
    reply: reply || 'Mình chưa hiểu ý bạn. Bạn hỏi về doanh thu, tồn kho, đơn chờ xử lý, hay muốn stage thay đổi giá/xuất bản?',
    staged,
    suggestions: ctx.suggestions,
  }
}

export type MerchantStreamEvent = StreamEvent<MerchantTurnResult>

export async function* streamMerchantTurn(
  history: ChatMessage[],
  deps?: { client?: MessagesClient; now?: Date; actorUserId?: string | null },
): AsyncGenerator<MerchantStreamEvent> {
  const client = deps?.client ?? createProviderClient()
  if (!client) {
    yield { type: 'result', result: { reply: DISABLED_REPLY, staged: [], suggestions: [], disabled: true } }
    return
  }

  const config = merchantConfig
  if (resolveProvider() === 'deepseek' && isUnsupportedReasonerModel(config.model)) {
    yield { type: 'result', result: { reply: REASONER_GUARD_REPLY, staged: [], suggestions: [] } }
    return
  }

  const ctx: MerchantDispatchContext = createMerchantContext(deps?.actorUserId ?? null)
  const userText = lastUserText(history)
  const system =
    `${buildMerchantStaticSystem()}\n\n` +
    buildMerchantDynamicContext(deps?.now ?? new Date(), {
      metricsHint: wantsMetricsGrounding(userText),
      changeHint: wantsChangeHint(userText),
    })
  const staged: SignedChange[] = []

  yield* streamTurn<MerchantTurnResult>(client, {
    model: config.model,
    maxTokens: config.maxTokens,
    maxIterations: config.maxToolIterations,
    system,
    tools: buildMerchantTools(),
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    forcedTool: wantsMetricsGrounding(userText) ? TOOL_SNAPSHOT : null,
    dispatch: async (name, input) => {
      const outcome = await dispatchMerchantTool(ctx, name, input)
      if (outcome.signed) staged.push(outcome.signed)
      return outcome.text
    },
    shouldEnd: () => ctx.endTurn,
    fallbackReply:
      'Mình chưa hiểu ý bạn. Bạn hỏi về doanh thu, tồn kho, đơn chờ xử lý, hay muốn stage thay đổi giá/xuất bản?',
    finish: (reply) => ({ reply, staged, suggestions: ctx.suggestions }),
  })
}
