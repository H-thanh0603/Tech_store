/**
 * Model providers behind the assistant's MessagesClient seam.
 *
 * - `anthropic` (default): native Messages API via @anthropic-ai/sdk.
 * - `deepseek`: DeepSeek's OpenAI-compatible `/chat/completions`, translated
 *   to/from the same Anthropic-shaped params so the turn loop is untouched.
 * - `openrouter`: OpenRouter's OpenAI-compatible endpoint — same translator,
 *   any tool-capable model (e.g. `anthropic/claude-haiku-4-5`).
 * - `tokenrouter`: any OpenAI-compatible gateway (base URL override via
 *   TOKENROUTER_BASE_URL, default https://api.tokenrouter.com/v1) — same
 *   translator, model via ASSISTANT_MODEL.
 *
 * Select with ASSISTANT_PROVIDER=anthropic|deepseek|openrouter|tokenrouter (default
 * anthropic). Keys are server-only: ANTHROPIC_API_KEY / DEEPSEEK_API_KEY /
 * OPENROUTER_API_KEY / TOKENROUTER_API_KEY.
 */

import Anthropic from '@anthropic-ai/sdk'

import type { MessagesClient, ProviderStreamEvent, StreamParams } from './agent'

export type AssistantProvider = 'anthropic' | 'deepseek' | 'openrouter' | 'tokenrouter'

export function resolveProvider(): AssistantProvider {
  if (process.env.ASSISTANT_PROVIDER === 'deepseek') return 'deepseek'
  if (process.env.ASSISTANT_PROVIDER === 'openrouter') return 'openrouter'
  if (process.env.ASSISTANT_PROVIDER === 'tokenrouter') return 'tokenrouter'
  return 'anthropic'
}

export function defaultModelFor(provider: AssistantProvider): string {
  if (process.env.ASSISTANT_MODEL) return process.env.ASSISTANT_MODEL
  if (provider === 'deepseek') return 'deepseek-chat'
  if (provider === 'openrouter') return 'anthropic/claude-haiku-4-5'
  if (provider === 'tokenrouter') return 'z-ai/glm-5.3-free'
  return 'claude-haiku-4-5'
}

/**
 * Reasoning models (e.g. GLM-5.3 on TokenRouter) spend completion budget on
 * `reasoning_content` before the visible `content`, so they need a larger
 * ceiling than the 1024 default. Translatable via ASSISTANT_MAX_TOKENS.
 */
export function defaultMaxTokensFor(provider: AssistantProvider): number {
  if (process.env.ASSISTANT_MAX_TOKENS) {
    const n = Number(process.env.ASSISTANT_MAX_TOKENS)
    if (Number.isInteger(n) && n >= 256 && n <= 32000) return n
  }
  return 1024
}

function createAnthropicClient(apiKey: string): MessagesClient {
  // Parity with the OpenAI-compatible path: bounded retries on 408/425/429/5xx
  // plus hard timeouts. The Anthropic SDK supports both natively.
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 })
  return {
    messages: {
      create: async (params) => {
        const message = await client.messages.create(
          {
            model: params.model,
            max_tokens: params.max_tokens,
            system: params.system,
            tools: params.tools,
            tool_choice: params.tool_choice,
            messages: params.messages,
          },
          { signal: AbortSignal.timeout(60_000) },
        )
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
        const stream = client.messages.stream(
          {
            model: params.model,
            max_tokens: params.max_tokens,
            system: params.system,
            tools: params.tools,
            tool_choice: params.tool_choice,
            messages: params.messages,
          },
          { signal: AbortSignal.timeout(90_000) },
        )
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

// -- OpenAI-compatible (DeepSeek direct + OpenRouter) ------------------------

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

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
    // Free-tier reasoning models (e.g. nex-n2.5-pro via 9router) burn ~30s
    // on hidden chain-of-thought before the first chunk, with zero benefit
    // for tool-calling turns. ASSISTANT_REASONING=0 skips it (1-2s first
    // chunk, tool calls verified intact).
    ...(process.env.ASSISTANT_REASONING === '0' ? { reasoning: { enabled: false } } : {}),
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
  const rawText = msg?.content ?? ''
  const { text: cleanText, calls: textCalls } = extractGlmToolCalls(rawText)
  if (cleanText) content.push({ type: 'text', text: cleanText })
  for (const call of textCalls) {
    content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })
  }
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
  const hasCalls = textCalls.length > 0 || (msg?.tool_calls?.length ?? 0) > 0
  return { content, stop_reason: finish === 'tool_calls' || hasCalls ? 'tool_use' : 'end_turn' }
}

/**
 * GLM models behind some gateways sometimes emit tool calls as pseudo-XML
 * text (`<tool_call>name<arg_key>k</arg_key><arg_value>v</arg_value>...`)
 * instead of OpenAI-style `tool_calls`. Rendered raw, that markup leaks
 * into the chat UI — and the tool never runs. Parse those blocks back into
 * real tool calls and strip them from the visible text.
 */
export interface GlmTextCall {
  id: string
  name: string
  input: Record<string, unknown>
}

function coerceArgValue(raw: string): unknown {
  const v = raw.trim()
  if (v === '') return v
  if (v === 'null' || v === 'NULL') return null
  if (v === 'true') return true
  if (v === 'false') return false
  // JSON arrays/objects first (e.g. identifiers list), then numbers.
  if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
    try {
      return JSON.parse(v) as unknown
    } catch {
      // Fall through to plain string.
    }
  }
  // Quoted strings: strip one layer of matching quotes.
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1)
  }
  if (/^-?\d+$/.test(v)) {
    const n = Number.parseInt(v, 10)
    return Number.isSafeInteger(n) ? n : v
  }
  if (/^-?\d+\.\d+$/.test(v)) {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : v
  }
  return v
}

/** Monotonic base so text-extracted ids stay unique across rounds/calls. */
let glmTextCallSeq = 0

/** Test-only reset for deterministic `glm-text-0` expectations. */
export function _resetGlmTextSeqForTests(): void {
  glmTextCallSeq = 0
}

export function extractGlmToolCalls(text: string): { text: string; calls: GlmTextCall[] } {
  const calls: GlmTextCall[] = []
  const base = glmTextCallSeq
  let count = 0
  const cleaned = text.replace(
    /<tool_call>\s*([a-zA-Z0-9_]+)\s*((?:<arg_key>[\s\S]*?<\/arg_value>\s*)*)<\/tool_call>/g,
    (_match, name: string, argsBody: string) => {
      const toolName = String(name ?? '').trim()
      // Skip empty/garbage names — dispatcher would permission-deny anyway,
      // but don't mint a tool_use for markup noise.
      if (!toolName) return ''
      const input: Record<string, unknown> = {}
      const argRe = /<arg_key>([\s\S]*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g
      let m: RegExpExecArray | null
      while ((m = argRe.exec(argsBody)) !== null) {
        const key = m[1].trim()
        if (!key) continue
        const value = coerceArgValue(m[2])
        if (key in input) {
          const prev = input[key]
          input[key] = Array.isArray(prev) ? [...prev, value] : [prev, value]
        } else {
          input[key] = value
        }
      }
      calls.push({ id: `glm-text-${base + count}`, name: toolName, input })
      count += 1
      return ''
    },
  )
  glmTextCallSeq += count
  return { text: cleaned.trim(), calls }
}

/**
 * Pilot only supports non-reasoning chat models. DeepSeek-R1 (and its
 * OpenRouter mirrors) leaks its chain of thought in `reasoning_content` and
 * its tool calls are unreliable — the translator intentionally does not
 * handle that shape. Fail fast with a clear message instead of burning money
 * on a flaky turn.
 */
export function isUnsupportedReasonerModel(model: string): boolean {
  const lower = model.toLowerCase()
  if (lower.includes('reasoner')) return true
  // R1 family in any namespace: deepseek-r1, deepseek/deepseek-r1:free, ...
  return /(^|[^a-z0-9])r1([^a-z0-9]|$)/.test(lower)
}

export const REASONER_GUARD_REPLY =
  'Trợ lý hiện chỉ hỗ trợ model chat thường (ví dụ deepseek-chat). Model reasoning ' +
  'không dùng được cho chế độ tool-calling này — bạn đổi ASSISTANT_MODEL giúp mình nhé.'

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const RETRY_DELAYS_MS = [500, 1500]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Honor provider Retry-After (seconds or HTTP date); else exponential backoff. */
function retryDelayMs(res: Response, attempt: number): number {
  const raw = res.headers?.get?.('retry-after')
  if (raw) {
    const secs = Number(raw)
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 30_000)
    const date = Date.parse(raw)
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 30_000)
  }
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
}

export async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown = null
  // A caller-supplied AbortSignal fires once: reusing it across attempts
  // would abort retries instantly. Strip it; each attempt gets its own.
  const { signal: _callerSignal, ...baseInit } = init
  void _callerSignal
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, { ...baseInit, signal: AbortSignal.timeout(60_000) })
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === attempts - 1) return res
      await sleep(retryDelayMs(res, attempt))
      continue
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

async function* streamOpenAICompatible(
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
  extraHeaders: Record<string, string> = {},
): AsyncGenerator<ProviderStreamEvent> {
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({ ...body, stream: true }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok || !res.body) throw new Error(`OpenAI-compatible HTTP ${res.status}`)
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
  const textIdx = content.findIndex((b) => b.type === 'text')
  if (textIdx !== -1) {
    // Streaming deltas reassemble the raw text, markup included — extract
    // GLM pseudo-XML tool calls the same way as the non-stream path.
    const block = content[textIdx]
    if (block?.type === 'text') {
      const { text: cleanText, calls: textCalls } = extractGlmToolCalls(block.text)
      if (textCalls.length > 0) {
        if (cleanText) block.text = cleanText
        else content.splice(textIdx, 1)
        for (const call of textCalls) {
          content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })
        }
      }
    }
  }
  if (content.length === 0) {
    // Same empty-generation flake as the non-stream path: fall back to one
    // non-stream call so the turn still gets a usable response.
    await sleep(1500)
    const retry = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    if (!retry.ok) throw new Error(`OpenAI-compatible HTTP ${retry.status}`)
    const parsed = fromDeepSeekResponse(
      (await retry.json()) as Parameters<typeof fromDeepSeekResponse>[0],
    )
    yield { type: 'message', content: parsed.content, stop_reason: parsed.stop_reason }
    return
  }
  const hasToolUse = content.some((b) => b.type === 'tool_use')
  yield { type: 'message', content, stop_reason: finish === 'tool_calls' || hasToolUse ? 'tool_use' : 'end_turn' }
}

export function parseOpenAICompatibleBody(text: string): Parameters<typeof fromDeepSeekResponse>[0] {
  return parseJsonPrefix(text) as Parameters<typeof fromDeepSeekResponse>[0]
}

/**
 * Parse the first complete top-level JSON value out of a body that may have
 * SSE `data: [DONE]` trailers appended (9router and similar gateways glue
 * them straight onto `}` with no newline).
 */
export function parseJsonPrefix(text: string): unknown {
  const sseAt = text.search(/\s*data:/)
  const head = (sseAt === -1 ? text : text.slice(0, sseAt)).trim()
  try {
    return JSON.parse(head)
  } catch {
    const end = scanJsonEnd(head)
    if (end !== -1) return JSON.parse(head.slice(0, end))
    throw new Error('bad JSON')
  }
}

/** Index just past the first complete top-level JSON value, or -1. */
function scanJsonEnd(s: string): number {
  let depth = 0
  let inStr = false
  let esc = false
  let started = false
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{' || ch === '[') {
      depth += 1
      started = true
    } else if (ch === '}' || ch === ']') {
      depth -= 1
      if (started && depth === 0) return i + 1
    }
  }
  return -1
}

export type OpenAICompatibleMessage = ReturnType<typeof fromDeepSeekResponse>

function createOpenAICompatibleClient(
  url: string,
  apiKey: string,
  extraHeaders: Record<string, string> = {},
): MessagesClient {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...extraHeaders }
  return {
    messages: {
      create: async (params) => {
        const outBody = toDeepSeekRequest(params) as Record<string, unknown>
        const res = await fetchWithRetry(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(outBody),
          signal: AbortSignal.timeout(60_000),
        })
        if (!res.ok) throw new Error(`OpenAI-compatible HTTP ${res.status}`)
        const text = await res.text()
        let parsed: OpenAICompatibleMessage
        try {
          parsed = fromDeepSeekResponse(parseOpenAICompatibleBody(text))
        } catch {
          throw new Error(`OpenAI-compatible bad JSON (first 120 chars): ${text.slice(0, 120)}`)
        }
        // Free-tier gateways occasionally return HTTP 200 with zero content
        // (no text, no tool calls). That response is useless to the turn loop,
        // so retry once before handing it back.
        if (parsed.content.length === 0) {
          await sleep(1500)
          const retry = await fetchWithRetry(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(outBody),
            signal: AbortSignal.timeout(60_000),
          })
          if (!retry.ok) throw new Error(`OpenAI-compatible HTTP ${retry.status}`)
          const retryText = await retry.text()
          try {
            return fromDeepSeekResponse(parseOpenAICompatibleBody(retryText))
          } catch {
            throw new Error(`OpenAI-compatible bad JSON (first 120 chars): ${retryText.slice(0, 120)}`)
          }
        }
        return parsed
      },
      stream: (params: StreamParams) =>
        streamOpenAICompatible(url, toDeepSeekRequest(params) as Record<string, unknown>, apiKey, extraHeaders),
    },
  }
}

function createDeepSeekClient(apiKey: string): MessagesClient {
  return createOpenAICompatibleClient(DEEPSEEK_URL, apiKey)
}

/** Server-side site origin for gateway attribution headers. */
export function gatewayReferer(): string {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'
  )
}

/** OpenRouter recommends identifying headers; the key still stays server-side. */
function createOpenRouterClient(apiKey: string): MessagesClient {
  return createOpenAICompatibleClient(OPENROUTER_URL, apiKey, {
    'HTTP-Referer': gatewayReferer(),
    'X-Title': 'TechStore Assistant',
  })
}

/** TokenRouter (or any OpenAI-compatible gateway): base URL ends with /chat/completions. */
export function tokenRouterUrl(): string {
  const raw = (process.env.TOKENROUTER_BASE_URL ?? 'https://api.tokenrouter.com/v1').replace(/\/$/, '')
  return raw.endsWith('/chat/completions') ? raw : `${raw}/chat/completions`
}

function createTokenRouterClient(apiKey: string): MessagesClient {
  return createOpenAICompatibleClient(tokenRouterUrl(), apiKey, {
    'HTTP-Referer': gatewayReferer(),
    'X-Title': 'TechStore Assistant',
  })
}

/** Build the configured provider client, or null when its key is missing. */
export function createProviderClient(): MessagesClient | null {
  const provider = resolveProvider()
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY
    return apiKey ? createDeepSeekClient(apiKey) : null
  }
  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY
    return apiKey ? createOpenRouterClient(apiKey) : null
  }
  if (provider === 'tokenrouter') {
    const apiKey = process.env.TOKENROUTER_API_KEY
    return apiKey ? createTokenRouterClient(apiKey) : null
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  return apiKey ? createAnthropicClient(apiKey) : null
}

/**
 * Fallback model chain: `ASSISTANT_MODEL_FALLBACK="model-a,model-b"`.
 * The turn loop tries the primary model first; on quota/overload errors
 * it retries round 0 once per fallback model instead of failing the turn.
 */
export function modelFallbackChain(primary: string): string[] {
  const extra = (process.env.ASSISTANT_MODEL_FALLBACK ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m && m !== primary)
  return [primary, ...extra].slice(0, 3)
}

/** True when the error looks like quota/overload (worth a model retry). */
export function isModelOverloadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return /503|502|429|overloaded|quota|rate limit|temporarily/i.test(msg)
}
