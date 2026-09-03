/**
 * Turn loop (port of `commerce-agents` Messages-API orchestrator, pilot
 * subset): non-streaming rounds of model → tools → results, with a forced
 * policy grounding gate, an iteration ceiling, and a text-only final round.
 *
 * Server-only: holds ANTHROPIC_API_KEY. The client is injectable for tests.
 */

import Anthropic from '@anthropic-ai/sdk'

import { assistantConfig, wantsOrderGrounding, wantsPolicyGrounding } from './config'
import { buildDynamicContext, buildStaticSystem } from './prompt'
import { createProviderClient, isUnsupportedReasonerModel, REASONER_GUARD_REPLY, resolveProvider } from './providers'
import {
  createDispatchContext,
  buildAnthropicTools,
  dispatchTool,
  TOOL_PRESENT_SUGGESTIONS,
  TOOL_SEARCH_POLICIES,
  type DispatchContext,
} from './tools'
import type { CardSummary } from './backend'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TurnResult {
  reply: string
  cards: CardSummary[]
  suggestions: string[]
  /** True when the assistant is not configured (missing API key). */
  disabled?: boolean
}

interface MinimalTextBlock {
  type: 'text'
  text: string
}

interface MinimalToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

type MinimalBlock = MinimalTextBlock | MinimalToolUseBlock

interface MinimalMessage {
  content: MinimalBlock[]
  stop_reason: string | null
}

export interface MessagesClient {
  messages: {
    create(params: {
      model: string
      max_tokens: number
      system: string
      tools: Anthropic.Tool[]
      tool_choice: Anthropic.ToolChoice
      messages: Anthropic.MessageParam[]
    }): Promise<MinimalMessage>
  }
}

function toAnthropicHistory(history: ChatMessage[]): Anthropic.MessageParam[] {
  return history.map((m) => ({ role: m.role, content: m.content }))
}

function lastUserText(history: ChatMessage[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'user') return history[i].content
  }
  return ''
}

function createRealClient(): MessagesClient | null {
  return createProviderClient()
}

const DISABLED_REPLY =
  'Trợ lý AI hiện chưa được cấu hình trên môi trường này. Bạn vẫn có thể dùng ô tìm kiếm, bộ lọc catalog hoặc trang theo dõi đơn hàng — hoặc quay lại sau.'

export async function runAssistantTurn(
  history: ChatMessage[],
  deps?: { client?: MessagesClient; now?: Date },
): Promise<TurnResult> {
  const client = deps?.client ?? createRealClient()
  if (!client) {
    return { reply: DISABLED_REPLY, cards: [], suggestions: [], disabled: true }
  }

  const config = assistantConfig
  if (resolveProvider() === 'deepseek' && isUnsupportedReasonerModel(config.model)) {
    return { reply: REASONER_GUARD_REPLY, cards: [], suggestions: [] }
  }
  const ctx: DispatchContext = createDispatchContext()
  const userText = lastUserText(history)
  const system = `${buildStaticSystem()}\n\n${buildDynamicContext(deps?.now ?? new Date(), {
    orderHint: config.enableOrders && wantsOrderGrounding(userText),
  })}`
  const tools = buildAnthropicTools()
  const messages = toAnthropicHistory(history)

  // Grounding gate (port of commerce-agents GROUNDING_RULES, pilot subset):
  // a policy question forces one policy read on the first iteration.
  const forcedTool =
    config.enablePolicies && wantsPolicyGrounding(userText) ? TOOL_SEARCH_POLICIES : null

  const replyParts: string[] = []

  for (let round = 0; round <= config.maxToolIterations; round += 1) {
    const forceText = round === config.maxToolIterations
    const tool_choice: Anthropic.ToolChoice =
      forceText
        ? { type: 'none' }
        : round === 0 && forcedTool
          ? { type: 'tool', name: forcedTool }
          : { type: 'auto' }

    let response: MinimalMessage
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
        reply: 'Xin lỗi, trợ lý đang bận. Bạn thử lại sau ít phút nhé.',
        cards: ctx.cards,
        suggestions: [],
      }
    }

    const assistantBlocks: Anthropic.ContentBlockParam[] = []
    const toolUses: MinimalToolUseBlock[] = []
    for (const block of response.content) {
      if (block.type === 'text') {
        if (block.text.trim()) replyParts.push(block.text)
        assistantBlocks.push({ type: 'text', text: block.text })
      } else if (block.type === 'tool_use') {
        toolUses.push(block)
        assistantBlocks.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        })
      }
    }
    messages.push({ role: 'assistant', content: assistantBlocks })

    if (toolUses.length === 0 || forceText) break

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of toolUses) {
      // present_suggestions ends the turn after its round (reference:
      // close_on_presentation) — still record the call's result for history.
      const text = await dispatchTool(ctx, use.name, use.input)
      results.push({ type: 'tool_result', tool_use_id: use.id, content: text })
      if (use.name === TOOL_PRESENT_SUGGESTIONS) ctx.endTurn = true
    }
    messages.push({ role: 'user', content: results })
    if (ctx.endTurn) break
  }

  const reply = replyParts.join('\n\n').trim()
  return {
    reply: reply || 'Mình chưa hiểu ý bạn. Bạn mô tả nhu cầu (máy gì, ngân sách bao nhiêu) để mình gợi ý nhé.',
    cards: ctx.cards.slice(0, 6),
    suggestions: ctx.suggestions,
  }
}
