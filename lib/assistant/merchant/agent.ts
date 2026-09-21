/**
 * Merchant turn loop (same MessagesClient seam + provider as the shopping
 * pilot). Stateless per request; staged envelopes return to the host UI for
 * approval — the model can never apply.
 */

import type Anthropic from '@anthropic-ai/sdk'

import { agentCall, type AgentCallObserver } from '../activity'
import type { ChatMessage, MessagesClient } from '../agent'
import { toAnthropicHistory } from '../agent'
import { createProviderClient, isUnsupportedReasonerModel, REASONER_GUARD_REPLY, resolveProvider } from '../providers'
import { streamTurn, type StreamEvent } from '../stream'
import {
  fullMerchantSummary,
  merchantFilterSummary,
  resolveMerchantTools,
  type ToolFilterSummary,
} from '../tool-filter'
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
  /** Tool-filter measurement (same shape as shopping). */
  toolFilter?: ToolFilterSummary
}

function prevUserTexts(history: ChatMessage[]): string[] {
  const texts = history.filter((m) => m.role === 'user').map((m) => m.content)
  return texts.slice(0, -1)
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
  deps?: {
    client?: MessagesClient
    now?: Date
    actorUserId?: string | null
    /** Real-time Agent Activity UI + audit: fired per tool call. */
    activity?: AgentCallObserver
  },
): Promise<MerchantTurnResult> {
  const client = deps?.client ?? createProviderClient()
  if (!client) {
    return { reply: DISABLED_REPLY, staged: [], suggestions: [], disabled: true, toolFilter: fullMerchantSummary() }
  }

  const config = merchantConfig
  if (resolveProvider() !== 'anthropic' && isUnsupportedReasonerModel(config.model)) {
    return { reply: REASONER_GUARD_REPLY, staged: [], suggestions: [], toolFilter: fullMerchantSummary() }
  }

  const ctx: MerchantDispatchContext = createMerchantContext(deps?.actorUserId ?? null)
  const userText = lastUserText(history)
  const system =
    `${buildMerchantStaticSystem()}\n\n` +
    buildMerchantDynamicContext(deps?.now ?? new Date(), {
      metricsHint: wantsMetricsGrounding(userText),
      changeHint: wantsChangeHint(userText),
    })
  const prevTexts = prevUserTexts(history)
  const filter = await resolveMerchantTools(userText, { prevTexts })
  let tools = filter.tools
  // Metrics grounding gate: a performance question forces one snapshot read first.
  const forcedTool = wantsMetricsGrounding(userText) ? TOOL_SNAPSHOT : null
  if (forcedTool && !tools.some((t) => t.name === forcedTool)) {
    const def = buildMerchantTools().find((t) => t.name === forcedTool)
    tools = def ? [...tools, def] : buildMerchantTools()
  }
  const toolFilter = merchantFilterSummary({ ...filter, tools })
  const messages: Anthropic.MessageParam[] = toAnthropicHistory(history)
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
        toolFilter,
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
      const call = agentCall(use.name, use.input)
      // Single source of activity: route layer persists audit via the
      // observer. Lib must not log directly (would double-log).
      deps?.activity?.(call)
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
    toolFilter,
  }
}

export type MerchantStreamEvent = StreamEvent<MerchantTurnResult>

export async function* streamMerchantTurn(
  history: ChatMessage[],
  deps?: {
    client?: MessagesClient
    now?: Date
    actorUserId?: string | null
    /** Real-time Agent Activity UI + audit: fired per tool call. */
    activity?: AgentCallObserver
  },
): AsyncGenerator<MerchantStreamEvent> {
  const client = deps?.client ?? createProviderClient()
  if (!client) {
    yield { type: 'result', result: { reply: DISABLED_REPLY, staged: [], suggestions: [], disabled: true, toolFilter: fullMerchantSummary() } }
    return
  }

  const config = merchantConfig
  if (resolveProvider() !== 'anthropic' && isUnsupportedReasonerModel(config.model)) {
    yield { type: 'result', result: { reply: REASONER_GUARD_REPLY, staged: [], suggestions: [], toolFilter: fullMerchantSummary() } }
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
  const streamFilter = await resolveMerchantTools(userText, { prevTexts: prevUserTexts(history) })
  let streamTools = streamFilter.tools
  const streamForcedTool = wantsMetricsGrounding(userText) ? TOOL_SNAPSHOT : null
  if (streamForcedTool && !streamTools.some((t) => t.name === streamForcedTool)) {
    const def = buildMerchantTools().find((t) => t.name === streamForcedTool)
    streamTools = def ? [...streamTools, def] : buildMerchantTools()
  }
  const streamFilterSummary = merchantFilterSummary({ ...streamFilter, tools: streamTools })

  yield* streamTurn<MerchantTurnResult>(client, {
    model: config.model,
    maxTokens: config.maxTokens,
    maxIterations: config.maxToolIterations,
    system,
    tools: streamTools,
    messages: toAnthropicHistory(history),
    forcedTool: streamForcedTool,
    dispatch: async (name, input) => {
      // No activity fire here: streamTurn already fires onActivity + yields
      // the SSE event. Firing here would duplicate UI steps + audit rows.
      const outcome = await dispatchMerchantTool(ctx, name, input)
      if (outcome.signed) staged.push(outcome.signed)
      return outcome.text
    },
    onActivity: deps?.activity,
    shouldEnd: () => ctx.endTurn,
    fallbackReply:
      'Mình chưa hiểu ý bạn. Bạn hỏi về doanh thu, tồn kho, đơn chờ xử lý, hay muốn stage thay đổi giá/xuất bản?',
    finish: (reply) => ({ reply, staged, suggestions: ctx.suggestions, toolFilter: streamFilterSummary }),
  })
}
