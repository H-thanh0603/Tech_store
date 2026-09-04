/**
 * Model providers behind the assistant's MessagesClient seam.
 *
 * - `anthropic` (default): native Messages API via @anthropic-ai/sdk.
 * - `deepseek`: DeepSeek's OpenAI-compatible `/chat/completions`, translated
 *   to/from the same Anthropic-shaped params so the turn loop is untouched.
 *
 * Select with ASSISTANT_PROVIDER=anthropic|deepseek (default anthropic).
 * Keys are server-only: ANTHROPIC_API_KEY / DEEPSEEK_API_KEY.
 */

import Anthropic from '@anthropic-ai/sdk'

import type { MessagesClient, ProviderStreamEvent, StreamParams } from './agent'

export type AssistantProvider = 'anthropic' | 'deepseek'

export function resolveProvider(): AssistantProvider {
  return process.env.ASSISTANT_PROVIDER === 'deepseek' ? 'deepseek' : 'anthropic'
}

export function defaultModelFor(provider: AssistantProvider): string {
  if (process.env.ASSISTANT_MODEL) return process.env.ASSISTANT_MODEL
  return provider === 'deepseek' ? 'deepseek-chat' : 'claude-haiku-4-5'
}

function createAnthropicClient(apiKey: string): MessagesClient {
  const client = new Anthropic({ apiKey })
  return {
    messages: {
      create: async (params) => {
        const message = await client.messages.create({
          model: params.model,
          max_tokens: params.max_tokens,
          system: params.system,
          tools: params.tools,
          tool_choice: params.tool_choice,
          messages: params.messages,
        })
        const content: (
          | { type: 'text'; text: string }
          | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        )[] = []
        for (const block of message.content) {
          if (block.type === 'text') content.push({ type: 'text', text: block.text })
          else if (block.type === 'tool_use') {
            content.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: (block.input ?? {}) as Record<string, unknown>,
            })
          }
        }
        return { content, stop_reason: message.stop_reason }
      },
      stream: async function* (params: StreamParams): AsyncGenerator<ProviderStreamEvent> {
        const stream = client.messages.stream({
          model: params.model,
          max_tokens: params.max_tokens,
          system: params.system,
          tools: params.tools,
          tool_choice: params.tool_choice,
          messages: params.messages,
        })
        // MessageStreamEvent is structurally light: only text deltas are read.
        const events = stream as AsyncIterable<{
          type: string
          delta?: { type: string; text?: string }
        }>
        for await (const event of events) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const text = event.delta.text ?? ''
            if (text) yield { type: 'text_delta', text }
          }
        }
        const final = await stream.finalMessage()
        const content: (
          | { type: 'text'; text: string }
          | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        )[] = []
        for (const block of final.content) {
          if (block.type === 'text') {
            if (block.text) content.push({ type: 'text', text: block.text })
          } else if (block.type === 'tool_use') {
            content.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: (block.input ?? {}) as Record<string, unknown>,
            })
          }
        }
        yield { type: 'message', content, stop_reason: final.stop_reason }
      },
    },
  }
}

// -- DeepSeek (OpenAI-compatible) -------------------------------------------

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

interface DSMessage {
  role: string
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

interface DSTool {
  type: 'function'
  function: { name: string; description?: string; parameters: unknown }
}

/** Local view over Anthropic content blocks: only the fields the converter reads. */
interface BlockView {
  type: string
  text?: unknown
  id?: unknown
  name?: unknown
  input?: unknown
  tool_use_id?: unknown
  content?: unknown
}

function view(block: unknown): BlockView {
  return block as BlockView
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function blockText(content: string | unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((raw) => {
      const b = view(raw)
      if (typeof raw === 'string') return raw
      if (b.type === 'text') return String(b.text ?? '')
      if (b.type === 'tool_result') {
        return typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
      }
      return ''
    })
    .join('\n')
}

export function toDeepSeekRequest(params: {
  model: string
  max_tokens: number
  system: string
  tools: Pick<Anthropic.Tool, 'name' | 'description' | 'input_schema'>[]
  tool_choice: { type?: string; name?: string }
  messages: Anthropic.MessageParam[]
}): Record<string, unknown> {
  const dsMessages: DSMessage[] = [{ role: 'system', content: params.system }]
  for (const m of params.messages) {
    if (m.role === 'user') {
      const raws = Array.isArray(m.content) ? m.content : []
      const results = raws.map(view).filter(
        (b): b is BlockView & { tool_use_id: string } =>
          b.type === 'tool_result' && typeof b.tool_use_id === 'string',
      )
      if (results.length > 0) {
        for (const r of results) {
          dsMessages.push({
            role: 'tool',
            tool_call_id: r.tool_use_id,
            content:
              typeof r.content === 'string' ? r.content : JSON.stringify(r.content ?? ''),
          })
        }
      } else {
        dsMessages.push({ role: 'user', content: blockText(m.content) })
      }
    } else {
      const blocks = (Array.isArray(m.content) ? m.content : []).map(view)
      const texts: string[] = []
      const calls: NonNullable<DSMessage['tool_calls']> = []
      for (const b of blocks) {
        if (typeof b === 'string') {
          texts.push(b)
          continue
        }
        if (b.type === 'text') texts.push(String(b.text ?? ''))
        else if (b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string') {
          calls.push({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(asRecord(b.input)) },
          })
        }
      }
      dsMessages.push({
        role: 'assistant',
        content: texts.join('\n') || null,
        ...(calls.length > 0 ? { tool_calls: calls } : {}),
      })
    }
  }

  const tools: DSTool[] = params.tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description ?? '', parameters: t.input_schema },
  }))

  const choice = params.tool_choice
  const tool_choice =
    choice.type === 'none'
      ? 'none'
      : choice.type === 'tool' && choice.name
        ? { type: 'function', function: { name: choice.name } }
        : 'auto'

  return {
    model: params.model,
    max_tokens: params.max_tokens,
    messages: dsMessages,
    tools,
    tool_choice,
  }
}

export function fromDeepSeekResponse(json: {
  choices?: {
    message?: {
      content?: string | null
      tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[]
    }
    finish_reason?: string
  }[]
}): {
  content: (
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  )[]
  stop_reason: string | null
} {
  const msg = json.choices?.[0]?.message
  const content: (
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  )[] = []
  if (msg?.content) content.push({ type: 'text', text: msg.content })
  for (const call of msg?.tool_calls ?? []) {
    let input: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(call.function?.arguments ?? '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        input = parsed as Record<string, unknown>
      }
    } catch {
      // Malformed arguments: empty input, the dispatcher reports the miss.
    }
    content.push({ type: 'tool_use', id: call.id, name: call.function?.name ?? '', input })
  }
  const finish = json.choices?.[0]?.finish_reason
  return { content, stop_reason: finish === 'tool_calls' ? 'tool_use' : 'end_turn' }
}

/**
 * Pilot only supports non-reasoning chat models. DeepSeek-R1 leaks its chain
 * of thought in `reasoning_content` and its tool calls are unreliable — the
 * translator intentionally does not handle that shape. Fail fast with a clear
 * message instead of burning money on a flaky turn.
 */
export function isUnsupportedReasonerModel(model: string): boolean {
  return model.toLowerCase().includes('reasoner') || model.toLowerCase().includes('/r1')
}

export const REASONER_GUARD_REPLY =
  'Trợ lý hiện chỉ hỗ trợ model chat thường (ví dụ deepseek-chat). Model reasoning ' +
  'không dùng được cho chế độ tool-calling này — bạn đổi ASSISTANT_MODEL giúp mình nhé.'

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const RETRY_DELAYS_MS = [500, 1500]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, init)
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === attempts - 1) return res
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1) throw error
    }
    await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)])
  }
  throw lastError instanceof Error ? lastError : new Error('DeepSeek request failed')
}

interface PendingToolCall {
  id: string
  name: string
  args: string
}

/**
 * Feed one SSE `data:` payload into the accumulator. Exported for tests.
 * Returns text deltas to yield immediately.
 */
export function feedDeepSeekDelta(
  pending: PendingToolCall[],
  payload: {
    choices?: {
      delta?: {
        content?: string | null
        tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[]
      }
      finish_reason?: string | null
    }[]
  },
): string[] {
  const deltas: string[] = []
  const delta = payload.choices?.[0]?.delta
  if (delta?.content) deltas.push(delta.content)
  for (const tc of delta?.tool_calls ?? []) {
    let slot = pending[tc.index]
    if (!slot) {
      slot = { id: '', name: '', args: '' }
      pending[tc.index] = slot
    }
    if (tc.id) slot.id = tc.id
    if (tc.function?.name) slot.name += tc.function.name
    if (tc.function?.arguments) slot.args += tc.function.arguments
  }
  return deltas
}

function toolUseBlocks(pending: PendingToolCall[]) {
  const blocks: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }[] = []
  for (const call of pending) {
    if (!call || !call.id) continue
    let input: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(call.args || '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        input = parsed as Record<string, unknown>
      }
    } catch {
      // Malformed arguments: empty input, the dispatcher reports the miss.
    }
    blocks.push({ type: 'tool_use', id: call.id, name: call.name, input })
  }
  return blocks
}

async function* streamDeepSeek(
  body: Record<string, unknown>,
  apiKey: string,
): AsyncGenerator<ProviderStreamEvent> {
  const res = await fetchWithRetry(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...body, stream: true }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok || !res.body) throw new Error(`DeepSeek HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const pending: PendingToolCall[] = []
  let fullText = ''
  let finish: string | null = null
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data) as Parameters<typeof feedDeepSeekDelta>[1]
          for (const t of feedDeepSeekDelta(pending, json)) {
            fullText += t
            yield { type: 'text_delta', text: t }
          }
          const reason = json.choices?.[0]?.finish_reason
          if (reason) finish = reason
        } catch {
          // Partial frame: wait for more bytes.
        }
      }
    }
  }
  const content: (
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  )[] = []
  if (fullText) content.push({ type: 'text', text: fullText })
  content.push(...toolUseBlocks(pending))
  yield { type: 'message', content, stop_reason: finish === 'tool_calls' ? 'tool_use' : 'end_turn' }
}

function createDeepSeekClient(apiKey: string): MessagesClient {
  return {
    messages: {
      create: async (params) => {
        const res = await fetchWithRetry(DEEPSEEK_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(toDeepSeekRequest(params)),
          signal: AbortSignal.timeout(60_000),
        })
        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`)
        return fromDeepSeekResponse(await res.json())
      },
      stream: (params: StreamParams) =>
        streamDeepSeek(toDeepSeekRequest(params) as Record<string, unknown>, apiKey),
    },
  }
}

/** Build the configured provider client, or null when its key is missing. */
export function createProviderClient(): MessagesClient | null {
  const provider = resolveProvider()
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY
    return apiKey ? createDeepSeekClient(apiKey) : null
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  return apiKey ? createAnthropicClient(apiKey) : null
}
