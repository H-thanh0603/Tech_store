/**
 * Jev decision layer (System One-style typed decisions).
 *
 * Two transports, same `{choice, confidence}` contract:
 * - `chat` (default): any OpenAI-compatible `/chat/completions` gateway.
 *   Jev proper (TypeSafe `typesafe/jev-latest` on OpenRouter) or any cheap
 *   tool-capable stand-in (e.g. local 9router) — prompts force JSON-only
 *   `{choice, confidence[, order]}` so the contract stays typed either way.
 * - `evaluate`: Vercel AI Gateway `/v1/evaluate` with the real Jev model
 *   (`typesafe-ai/jev`) — a native choice/score API, no JSON scraping.
 *   Auto-selected when JEV_BASE_URL points at ai-gateway.vercel.sh or
 *   JEV_MODEL starts with `typesafe-ai/`; override with JEV_API=chat|evaluate.
 *
 * Jev never replaces the shopping turn loop (`agent.ts` needs text +
 * tool_use). It sits BEFORE / BESIDE the LLM as a cheap classifier:
 * semantic scope triage + relevance re-rank after `search_products`.
 *
 * Fail-open: no key / timeout / bad JSON → null, caller falls back
 * to keyword/DB behaviour. Chat never breaks because Jev is down.
 */

import { OPENROUTER_URL, gatewayReferer, parseJsonPrefix } from './providers'
import type { ScopeVerdict } from './scope'

export const JEV_DEFAULT_MODEL = 'typesafe/jev-latest'

export interface JevDecision {
  choice: string
  confidence: number
  raw: string
}

function env(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : undefined
}

export function jevTimeoutMs(): number {
  const n = Number(env('JEV_TIMEOUT_MS'))
  if (Number.isFinite(n) && n >= 500 && n <= 15000) return Math.floor(n)
  return 3500
}

export function jevThreshold(): number {
  const n = Number(env('JEV_THRESHOLD'))
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  return 0.7
}

/**
 * Completion budget per decision. Reasoning-capable stand-ins (e.g. GLM /
 * Ling on a local gateway) spend tokens on hidden reasoning before the
 * visible JSON, so 128 truncates the answer to `content: null`. 512 leaves
 * room for both; override with JEV_MAX_TOKENS (64–4096).
 */
export function jevMaxTokens(): number {
  const n = Number(env('JEV_MAX_TOKENS'))
  if (Number.isInteger(n) && n >= 64 && n <= 4096) return n
  return 512
}

export function jevModel(): string {
  return env('JEV_MODEL') ?? JEV_DEFAULT_MODEL
}

export function jevUrl(): string {
  const raw = (env('JEV_BASE_URL') ?? OPENROUTER_URL).replace(/\/$/, '')
  return raw.endsWith('/chat/completions') ? raw : `${raw}/chat/completions`
}

export type JevApi = 'chat' | 'evaluate'

/**
 * Which transport to use. Auto-detect: Vercel AI Gateway (`typesafe-ai/`
 * model or ai-gateway.vercel.sh base) speaks the native Evaluation API;
 * everything else is OpenAI-compatible chat. `JEV_API` forces either.
 */
export function jevApi(): JevApi {
  const forced = env('JEV_API')
  if (forced === 'evaluate' || forced === 'chat') return forced
  if (jevModel().startsWith('typesafe-ai/')) return 'evaluate'
  if ((env('JEV_BASE_URL') ?? '').includes('ai-gateway.vercel.sh')) return 'evaluate'
  return 'chat'
}

/** Base URL for the Evaluation API (same host as JEV_BASE_URL, `/v1/evaluate`). */
export function jevEvaluateUrl(): string {
  const raw = (env('JEV_BASE_URL') ?? 'https://ai-gateway.vercel.sh/v1').replace(/\/$/, '')
  return raw.endsWith('/evaluate') ? raw : `${raw}/evaluate`
}

export function jevApiKey(): string | null {
  return env('JEV_API_KEY') ?? env('OPENROUTER_API_KEY') ?? null
}

export function isJevEnabled(): boolean {
  if (env('JEV_ENABLED') === '0') return false
  return jevApiKey() != null
}

/** Last JEV failure reason (for /api/health + logs). Null when healthy/unused. */
let lastJevError: string | null = null
let jevWarned = false

/** Short-lived decision cache: identical gray texts skip the gateway. */
const DECIDE_CACHE_MAX = 100
const DECIDE_CACHE_TTL_MS = 5 * 60_000
const decideCache = new Map<string, { decision: JevDecision; at: number }>()

function decideCacheKey(question: string, choices: readonly string[], context: string): string {
  return `${question}\n${choices.join('|')}\n${context.slice(0, 400)}`
}

function decideCacheGet(key: string): JevDecision | null {
  const hit = decideCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > DECIDE_CACHE_TTL_MS) {
    decideCache.delete(key)
    return null
  }
  return hit.decision
}

function decideCacheSet(key: string, decision: JevDecision): void {
  if (decideCache.size >= DECIDE_CACHE_MAX) {
    const oldest = decideCache.keys().next().value
    if (oldest !== undefined) decideCache.delete(oldest)
  }
  decideCache.set(key, { decision, at: Date.now() })
}

export function jevLastError(): string | null {
  return lastJevError
}

/** Log once per process so a dead gateway doesn't spam the log every turn. */
function warnJevOnce(reason: string): void {
  lastJevError = reason
  if (jevWarned || process.env.NODE_ENV === 'test') return
  jevWarned = true
  console.warn(`[jev] decision layer failing, fail-open active: ${reason}`)
}

/** Test helper: reset the once-per-process warn flag. */
export function _resetJevWarnForTests(): void {
  jevWarned = false
  lastJevError = null
  decideCache.clear()
}
export async function jevDecide(input: {
  question: string
  choices: readonly string[]
  context: string
  fetchFn?: typeof fetch
}): Promise<JevDecision | null> {
  const apiKey = jevApiKey()
  if (!apiKey) return null
  const { question, choices, context, fetchFn } = input
  if (choices.length < 2) return null
  const cacheKey = decideCacheKey(question, choices, context)
  const cached = decideCacheGet(cacheKey)
  if (cached) return cached
  if (jevApi() === 'evaluate') {
    const decision = await jevDecideEvaluate({ question, choices, context, apiKey, fetchFn })
    if (decision) decideCacheSet(cacheKey, decision)
    return decision
  }
  const doFetch = fetchFn ?? fetch
  const system =
    'You are Jev, a System One decision model. Return typed decisions, never prose. ' +
    'Reply with JSON ONLY: {"choice": "<one of the allowed choices>", "confidence": 0.0-1.0}.'
  const user =
    `Question: ${question}\nAllowed choices: ${choices.join(' | ')}\n` +
    `Context: ${context.slice(0, 800)}\nReturn JSON only.`
  try {
    const res = await doFetch(jevUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': gatewayReferer(),
        'X-Title': 'TechStore Jev decision layer',
      },
      body: JSON.stringify({
        model: jevModel(),
        max_tokens: jevMaxTokens(),
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(jevTimeoutMs()),
    })
    if (!res.ok) {
      warnJevOnce(`chat HTTP ${res.status}`)
      return null
    }
    const json = parseJsonPrefix(await res.text()) as {
      choices?: { message?: { content?: string | null } }[]
    }
    const raw = String(json.choices?.[0]?.message?.content ?? '').slice(0, 500)
    if (!raw) {
      warnJevOnce('chat empty content')
      return null
    }
    const decision = parseJevDecision(raw, choices)
    if (!decision) warnJevOnce('chat bad JSON')
    else {
      lastJevError = null
      decideCacheSet(cacheKey, decision)
    }
    return decision
  } catch {
    warnJevOnce('chat network/timeout')
    return null
  }
}

export function parseJevDecision(raw: string, choices: readonly string[]): JevDecision | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { choice?: unknown; confidence?: unknown }
    const choice = typeof parsed.choice === 'string' ? parsed.choice.trim() : ''
    if (!choices.includes(choice)) return null
    const c = Number(parsed.confidence)
    const confidence = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5
    return { choice, confidence, raw: raw.slice(0, 200) }
  } catch {
    return null
  }
}

interface EvaluateAnswer {
  type?: unknown
  choice?: unknown
  probabilities?: unknown
}

/**
 * Parse a `/v1/evaluate` choice answer into `{choice, confidence}`.
 * Reads the single question named `decision`; rejects choices outside
 * the allowed list (same fail-open contract as the chat path).
 */
export function parseEvaluateDecision(
  answers: Record<string, EvaluateAnswer> | null | undefined,
  choices: readonly string[],
): JevDecision | null {
  const answer = answers?.decision
  const choice = typeof answer?.choice === 'string' ? answer.choice.trim() : ''
  if (!choice || !choices.includes(choice)) return null
  const probs = answer?.probabilities
  const p =
    probs && typeof probs === 'object' && !Array.isArray(probs)
      ? Number((probs as Record<string, unknown>)[choice])
      : NaN
  const confidence = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0.5
  return { choice, confidence, raw: JSON.stringify(answer).slice(0, 200) }
}

/**
 * Native Jev decision via Vercel AI Gateway `/v1/evaluate`
 * (`typesafe-ai/jev`): one choice question, no JSON scraping.
 */
async function jevDecideEvaluate(input: {
  question: string
  choices: readonly string[]
  context: string
  apiKey: string
  fetchFn?: typeof fetch
}): Promise<JevDecision | null> {
  const { question, choices, context, apiKey, fetchFn } = input
  const criteria: Record<string, string> = {}
  for (const c of choices) criteria[c] = `The message belongs to the "${c}" category.`
  try {
    const res = await (fetchFn ?? fetch)(jevEvaluateUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: jevModel(),
        state: `Question: ${question}\nMessage: ${context.slice(0, 800)}`,
        questions: {
          decision: { type: 'choice', instructions: question, criteria },
        },
      }),
      signal: AbortSignal.timeout(jevTimeoutMs()),
    })
    if (!res.ok) {
      warnJevOnce(`evaluate HTTP ${res.status}`)
      return null
    }
    const json = (await res.json()) as { answers?: Record<string, EvaluateAnswer> }
    const decision = parseEvaluateDecision(json.answers, choices)
    if (!decision) warnJevOnce('evaluate bad answer')
    else lastJevError = null
    return decision
  } catch {
    warnJevOnce('evaluate network/timeout')
    return null
  }
}
const SHOPPING_QUESTION =
  'Is this customer message a TechStore shopping request (products, price, compare, cart, orders, shipping, store policy)?'
const MERCHANT_QUESTION =
  'Is this staff message a TechStore operations request (revenue, inventory, pending orders, listings, pricing, campaigns)?'

async function resolveScope(
  text: string,
  check: (t: string) => ScopeVerdict,
  question: string,
  fetchFn?: typeof fetch,
): Promise<ScopedVerdict> {
  const keyword = check(text)
  if (keyword === 'in-scope') return { verdict: keyword, source: 'keyword', confidence: null }
  if (!isJevEnabled()) return { verdict: keyword, source: 'disabled', confidence: null }
  const decision = await jevDecide({
    question,
    choices: ['in-scope', 'gray', 'off-topic'] as const,
    context: text,
    fetchFn,
  })
  if (!decision || decision.confidence < jevThreshold()) {
    return { verdict: keyword, source: 'keyword', confidence: decision?.confidence ?? null }
  }
  return { verdict: decision.choice as ScopeVerdict, source: 'keyword+jev', confidence: decision.confidence }
}

export async function resolveShoppingScope(
  text: string,
  deps?: { fetchFn?: typeof fetch; check?: (t: string) => ScopeVerdict },
): Promise<ScopedVerdict> {
  const { checkShoppingScope } = await import('./scope')
  return resolveScope(text, deps?.check ?? checkShoppingScope, SHOPPING_QUESTION, deps?.fetchFn)
}

export async function resolveMerchantScope(
  text: string,
  deps?: { fetchFn?: typeof fetch; check?: (t: string) => ScopeVerdict },
): Promise<ScopedVerdict> {
  const { checkMerchantScope } = await import('./scope')
  return resolveScope(text, deps?.check ?? checkMerchantScope, MERCHANT_QUESTION, deps?.fetchFn)
}


export interface ScopedVerdict {
  verdict: ScopeVerdict
  source: 'keyword' | 'jev' | 'keyword+jev' | 'disabled'
  confidence: number | null
}
export interface RankCandidate {
  product_id: string
  name: string
  brand?: string | null
  price?: number | null
}

export async function jevRankIndices(
  query: string,
  candidates: RankCandidate[],
  fetchFn?: typeof fetch,
): Promise<number[] | null> {
  if (!isJevEnabled() || candidates.length <= 1 || !query.trim()) return null
  const shortlist = candidates.slice(0, 6)
  const apiKey = jevApiKey()
  if (!apiKey) return null
  if (jevApi() === 'evaluate') return jevRankEvaluate(query, shortlist, apiKey, fetchFn)
  const context =
    `Customer query: ${query.slice(0, 160)}\n` +
    shortlist
      .map((c, i) => `${i}: ${c.name}${c.brand ? ` (${c.brand})` : ''}`)
      .join('\n') +
    '\nReply JSON ONLY: {"choice":"ranked","confidence":0-1,"order":[indices most relevant first]}.'
  try {
    const res = await (fetchFn ?? fetch)(jevUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': gatewayReferer(),
        'X-Title': 'TechStore Jev re-rank',
      },
      body: JSON.stringify({
        model: jevModel(),
        max_tokens: jevMaxTokens(),
        temperature: 0,
        messages: [
          { role: 'system', content: 'You rank products. Reply JSON ONLY: {"choice":"ranked","confidence":0-1,"order":[indices]}.' },
          { role: 'user', content: context },
        ],
      }),
      signal: AbortSignal.timeout(jevTimeoutMs()),
    })
    if (!res.ok) {
      warnJevOnce(`rank chat HTTP ${res.status}`)
      return null
    }
    const json = parseJsonPrefix(await res.text()) as { choices?: { message?: { content?: string | null } }[] }
    const raw = String(json.choices?.[0]?.message?.content ?? '')
    const indices = parseRankIndices(raw, shortlist.length)
    if (!indices) warnJevOnce('rank chat bad JSON')
    else lastJevError = null
    return indices
  } catch {
    warnJevOnce('rank chat network/timeout')
    return null
  }
}

/**
 * Re-rank via `/v1/evaluate`: one score question per candidate in a single
 * request (the API answers questions in parallel), ordered by score desc.
 */
async function jevRankEvaluate(
  query: string,
  shortlist: RankCandidate[],
  apiKey: string,
  fetchFn?: typeof fetch,
): Promise<number[] | null> {
  const questions: Record<string, unknown> = {}
  shortlist.forEach((c, i) => {
    questions[`rel_${i}`] = {
      type: 'score',
      instructions: `How relevant is this product to the customer query "${query.slice(0, 160)}"? Product: ${c.name}${c.brand ? ` (${c.brand})` : ''}`,
      criteria: ['irrelevant', 'somewhat relevant', 'relevant', 'perfect match'],
    }
  })
  try {
    const res = await (fetchFn ?? fetch)(jevEvaluateUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: jevModel(),
        state: `Customer query: ${query.slice(0, 160)}`,
        questions,
      }),
      signal: AbortSignal.timeout(jevTimeoutMs()),
    })
    if (!res.ok) {
      warnJevOnce(`rank evaluate HTTP ${res.status}`)
      return null
    }
    const json = (await res.json()) as {
      answers?: Record<string, { score?: unknown }>
    }
    const scored = shortlist.map((_, i) => {
      const s = Number(json.answers?.[`rel_${i}`]?.score)
      return { i, score: Number.isFinite(s) ? s : -1 }
    })
    if (scored.every((s) => s.score < 0)) {
      warnJevOnce('rank evaluate bad answer')
      return null
    }
    lastJevError = null
    return scored.sort((a, b) => b.score - a.score).map((s) => s.i)
  } catch {
    warnJevOnce('rank evaluate network/timeout')
    return null
  }
}

export function parseRankIndices(raw: string, size: number): number[] | null {  const match = raw.match(/\[[\d,\s]*\]/)
  if (!match) return null
  try {
    const indices = JSON.parse(match[0]) as unknown
    if (!Array.isArray(indices) || indices.length === 0) return null
    const seen = new Set<number>()
    const out: number[] = []
    for (const n of indices) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n >= size || seen.has(n)) continue
      seen.add(n)
      out.push(n)
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

export function applyRankOrder<T>(items: T[], indices: number[] | null): T[] {
  if (!indices) return items
  const seen = new Set<number>()
  const ordered: T[] = []
  for (const i of indices) {
    if (i >= 0 && i < items.length && !seen.has(i)) {
      seen.add(i)
      const item = items[i]
      if (item !== undefined) ordered.push(item)
    }
  }
  for (let i = 0; i < items.length; i += 1) {
    if (!seen.has(i)) {
      const item = items[i]
      if (item !== undefined) ordered.push(item)
    }
  }
  return ordered
}

