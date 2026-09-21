/**
 * Turn loop (port of `commerce-agents` Messages-API orchestrator, pilot
 * subset): non-streaming rounds of model → tools → results, with a forced
 * policy grounding gate, an iteration ceiling, and a text-only final round.
 *
 * Server-only: holds ANTHROPIC_API_KEY. The client is injectable for tests.
 */

import Anthropic from '@anthropic-ai/sdk'

import { agentCall, type AgentCallObserver } from './activity'
import { assistantConfig, wantsOrderGrounding, wantsPolicyGrounding } from './config'
import { hasHumanCartConfirm } from './cart-confirm'
import { buildDynamicContext, buildStaticSystem } from './prompt'
import { createProviderClient, isUnsupportedReasonerModel, REASONER_GUARD_REPLY, resolveProvider } from './providers'
import { streamTurn, type StreamEvent } from './stream'
import {
  buildAnthropicTools,
  createDispatchContext,
  dispatchTool,
  TOOL_PRESENT_SUGGESTIONS,
  TOOL_SEARCH_POLICIES,
  type DispatchContext,
} from './tools'
import {
  fullShoppingSummary,
  resolveShoppingTools,
  shoppingFilterSummary,
  type ToolFilterSummary,
} from './tool-filter'
import type { CartRpcClient } from './cart'
import { getChatCart } from './cart'
import type { CardSummary, CompareResult, FulfillmentOptions, OrderStatusSummary, PlanDraft } from './backend'
import type { MemoryFacts } from './memory'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TurnResult {
  reply: string
  cards: CardSummary[]
  suggestions: string[]
  /** Side-by-side compare matrix (compare flow) — rendered as a table. */
  comparison?: CompareResult | null
  /** Interactive shopping plan (plan flow) — checklist + add-all. */
  plan?: PlanDraft | null
  /** Order tracking result (track_order flow) — rendered inline. */
  tracking?: OrderStatusSummary | null
  /** Fulfillment options (get_fulfillment_options flow) — rendered before checkout. */
  fulfillment?: FulfillmentOptions | null
  /** Current cart snapshot (item count + subtotal) for header chip. */
  cart?: { item_count: number; subtotal: number } | null
  /** Budget from memory for persistent budget chip. */
  budget_vnd?: number | null
  /** True when the assistant is not configured (missing API key). */
  disabled?: boolean
  /**
   * Tool-filter measurement: which buckets the turn sent, from where
   * (keyword/history/jev/full) and how many schemas went to the model.
   */
  toolFilter?: ToolFilterSummary
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

export type ProviderStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'message'; content: MinimalBlock[]; stop_reason: string | null }

export interface StreamParams {
  model: string
  max_tokens: number
  system: string
  tools: Anthropic.Tool[]
  tool_choice: Anthropic.ToolChoice
  messages: Anthropic.MessageParam[]
}

export interface MessagesClient {
  messages: {
    create(params: StreamParams): Promise<MinimalMessage>
    stream?(params: StreamParams): AsyncGenerator<ProviderStreamEvent>
  }
}

const HISTORY_TAIL_MESSAGES = 12
const HISTORY_TEXT_CHARS = 2000

/** Best-effort post-turn cart snapshot for the header chip (fail-open). */
async function cartSnapshot(
  cartTokenHash: string | null | undefined,
  cartRpc?: CartRpcClient,
): Promise<{ item_count: number; subtotal: number } | null> {
  if (!cartTokenHash) return null
  try {
    const cart = await getChatCart(cartTokenHash, cartRpc)
    return { item_count: cart.item_count, subtotal: cart.subtotal }
  } catch {
    return null
  }
}

export function toAnthropicHistory(history: ChatMessage[]): Anthropic.MessageParam[] {
  // Context management: cap the tail so a long chat cannot blow the context
  // window or the bill. Text is truncated per message; tool_use/tool_result
  // blocks stay intact, and the slice starts at a user message so a tail
  // tool_result is never orphaned from its tool_use.
  let tail = history.slice(-HISTORY_TAIL_MESSAGES)
  const firstUser = tail.findIndex((m) => m.role === 'user')
  if (firstUser > 0) tail = tail.slice(firstUser)
  return tail.map((m) => ({
    role: m.role,
    content: m.content.length > HISTORY_TEXT_CHARS ? `${m.content.slice(0, HISTORY_TEXT_CHARS)}…[cắt bớt]` : m.content,
  }))
}

function lastUserText(history: ChatMessage[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'user') return history[i].content
  }
  return ''
}

/** Previous user messages (oldest first) for filter history inheritance. */
function prevUserTexts(history: ChatMessage[]): string[] {
  const texts = history.filter((m) => m.role === 'user').map((m) => m.content)
  return texts.slice(0, -1)
}

function createRealClient(): MessagesClient | null {
  return createProviderClient()
}

const DISABLED_REPLY =
  'Trợ lý AI hiện chưa được cấu hình trên môi trường này. Bạn vẫn có thể dùng ô tìm kiếm, bộ lọc catalog hoặc trang theo dõi đơn hàng — hoặc quay lại sau.'

/** Weak models sometimes end the turn with tool calls and no text; summarize
 *  the cards the tools already produced instead of claiming we didn't understand. */
function fallbackReply(ctx: { cards: { name: string; price: number }[] }): string {
  if (ctx.cards.length === 0)
    return 'Mình chưa hiểu ý bạn. Bạn mô tả nhu cầu (máy gì, ngân sách bao nhiêu) để mình gợi ý nhé.'
  const top = ctx.cards
    .slice(0, 3)
    .map((c) => `${c.name} (${c.price.toLocaleString('vi-VN')}đ)`)
    .join(', ')
  return `Mình tìm được vài món trong kho: ${top}. Bạn muốn xem chi tiết món nào không?`
}

export async function runAssistantTurn(
  history: ChatMessage[],
  deps?: {
    client?: MessagesClient
    now?: Date
    cartTokenHash?: string | null
    cartRpc?: CartRpcClient
    memory?: MemoryFacts
    /** Real-time Agent Activity UI + audit: fired per tool call. */
    activity?: AgentCallObserver
  },
): Promise<TurnResult> {
  const client = deps?.client ?? createRealClient()
  if (!client) {
    return { reply: DISABLED_REPLY, cards: [], suggestions: [], disabled: true, toolFilter: fullShoppingSummary() }
  }

  const config = assistantConfig
  if (resolveProvider() !== 'anthropic' && isUnsupportedReasonerModel(config.model)) {
    return { reply: REASONER_GUARD_REPLY, cards: [], suggestions: [], toolFilter: fullShoppingSummary() }
  }
  const ctx: DispatchContext = createDispatchContext({
    cartTokenHash: deps?.cartTokenHash ?? null,
    cartRpc: deps?.cartRpc,
    userConfirmed: hasHumanCartConfirm(lastUserText(history)),
  })
  const userText = lastUserText(history)
  const system = `${buildStaticSystem()}\n\n${buildDynamicContext(deps?.now ?? new Date(), {
    orderHint: config.enableOrders && wantsOrderGrounding(userText),
    memory: deps?.memory,
  })}`
  const messages = toAnthropicHistory(history)

  // Grounding gate (port of commerce-agents GROUNDING_RULES, pilot subset):
  // a policy question forces one policy read on the first iteration.
  const forcedTool =
    config.enablePolicies && wantsPolicyGrounding(userText) ? TOOL_SEARCH_POLICIES : null
  // Tool-filter layer: shrink the schema the model sees to the buckets the
  // message needs (fail-open full set). Gray follow-ups inherit the
  // previous turn's buckets without a JEV call. The forced gate tool must
  // be present.
  const prevTexts = prevUserTexts(history)
  const filter = await resolveShoppingTools(userText, { prevTexts })
  let tools = filter.tools
  if (forcedTool && !tools.some((t) => t.name === forcedTool)) {
    const def = buildAnthropicTools().find((t) => t.name === forcedTool)
    tools = def ? [...tools, def] : buildAnthropicTools()
  }
  const toolFilter = shoppingFilterSummary({ ...filter, tools })

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
        comparison: ctx.comparison,
        plan: ctx.plan,
        tracking: ctx.tracking,
        fulfillment: ctx.fulfillment,
        cart: await cartSnapshot(ctx.cartTokenHash, ctx.cartRpc),
        budget_vnd: deps?.memory?.budget_vnd ?? null,
        toolFilter,
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
      deps?.activity?.(agentCall(use.name, use.input))
      const text = await dispatchTool(ctx, use.name, use.input)
      results.push({ type: 'tool_result', tool_use_id: use.id, content: text })
      if (use.name === TOOL_PRESENT_SUGGESTIONS) ctx.endTurn = true
    }
    messages.push({ role: 'user', content: results })
    if (ctx.endTurn) break
  }

  const reply = replyParts.join('\n\n').trim()
  return {
    reply: reply || fallbackReply(ctx),
    cards: ctx.cards.slice(0, 6),
    suggestions: ctx.suggestions,
    comparison: ctx.comparison,
    plan: ctx.plan,
    tracking: ctx.tracking,
    fulfillment: ctx.fulfillment,
    cart: await cartSnapshot(ctx.cartTokenHash, ctx.cartRpc),
    budget_vnd: deps?.memory?.budget_vnd ?? null,
    toolFilter,
  }
}

export type ShoppingStreamEvent = StreamEvent<TurnResult>

/**
 * Streaming variant of runAssistantTurn. Same grounding, tools and caps;
 * yields text deltas then one result. Falls back to a single create() call
 * per round when the provider has no stream() implementation.
 */
export async function* streamAssistantTurn(
  history: ChatMessage[],
  deps?: {
    client?: MessagesClient
    now?: Date
    cartTokenHash?: string | null
    cartRpc?: CartRpcClient
    memory?: MemoryFacts
    /** Real-time Agent Activity UI + audit: fired per tool call. */
    activity?: AgentCallObserver
  },
): AsyncGenerator<ShoppingStreamEvent> {
  const client = deps?.client ?? createRealClient()
  if (!client) {
    yield { type: 'result', result: { reply: DISABLED_REPLY, cards: [], suggestions: [], disabled: true, toolFilter: fullShoppingSummary() } }
    return
  }

  const config = assistantConfig
  const ctx: DispatchContext = createDispatchContext({
    cartTokenHash: deps?.cartTokenHash ?? null,
    cartRpc: deps?.cartRpc,
    userConfirmed: hasHumanCartConfirm(lastUserText(history)),
  })
  const userText = lastUserText(history)
  const system = `${buildStaticSystem()}\n\n${buildDynamicContext(deps?.now ?? new Date(), {
    orderHint: config.enableOrders && wantsOrderGrounding(userText),
    memory: deps?.memory,
  })}`

  const forcedToolName =
    config.enablePolicies && wantsPolicyGrounding(userText) ? TOOL_SEARCH_POLICIES : null
  const streamFilter = await resolveShoppingTools(userText, { prevTexts: prevUserTexts(history) })
  let streamTools = streamFilter.tools
  if (forcedToolName && !streamTools.some((t) => t.name === forcedToolName)) {
    const def = buildAnthropicTools().find((t) => t.name === forcedToolName)
    streamTools = def ? [...streamTools, def] : buildAnthropicTools()
  }
  const streamFilterSummary = shoppingFilterSummary({ ...streamFilter, tools: streamTools })

  yield* streamTurn<TurnResult>(client, {
    model: config.model,
    maxTokens: config.maxTokens,
    maxIterations: config.maxToolIterations,
    system,
    tools: streamTools,
    messages: toAnthropicHistory(history),
    forcedTool: forcedToolName,
    dispatch: (name, input) => dispatchTool(ctx, name, input),
    onActivity: deps?.activity,
    shouldEnd: () => ctx.endTurn,
    fallbackReply: () => fallbackReply(ctx),
    finish: async (reply) => ({
      reply,
      cards: ctx.cards.slice(0, 6),
      suggestions: ctx.suggestions,
      comparison: ctx.comparison,
      plan: ctx.plan,
      tracking: ctx.tracking,
      fulfillment: ctx.fulfillment,
      cart: await cartSnapshot(ctx.cartTokenHash, ctx.cartRpc),
      budget_vnd: deps?.memory?.budget_vnd ?? null,
      toolFilter: streamFilterSummary,
    }),
  })
}
