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
import type { OrderRiskInput, RiskAssessment } from './risk'

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
  scoreCache.clear()
  noulCache.clear()
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

/**
 * Nhiều choice question trong 1 request `/v1/evaluate` (API trả lời song
 * song). Chỉ evaluate path; chat path rớt về `jevDecide` tuần tự — caller
 * nên check `jevApi()==='evaluate'` trước. Fail-open → null toàn bộ.
 */
export async function jevDecideMany(input: {
  questions: Record<string, { instructions: string; choices: readonly string[] }>
  context: string
  fetchFn?: typeof fetch
}): Promise<Record<string, JevDecision | null> | null> {
  const apiKey = jevApiKey()
  if (!apiKey) return null
  const { questions, context, fetchFn } = input
  const names = Object.keys(questions)
  if (names.length === 0) return null
  const qs: Record<string, unknown> = {}
  for (const name of names) {
    const q = questions[name]
    if (!q || q.choices.length < 2) return null
    const criteria: Record<string, string> = {}
    for (const c of q.choices) criteria[c] = `The message belongs to the "${c}" category.`
    qs[name] = { type: 'choice', instructions: q.instructions, criteria }
  }
  try {
    const res = await (fetchFn ?? fetch)(jevEvaluateUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: jevModel(),
        state: `Message: ${context.slice(0, 800)}`,
        questions: qs,
      }),
      signal: AbortSignal.timeout(jevTimeoutMs()),
    })
    if (!res.ok) {
      warnJevOnce(`evaluate-many HTTP ${res.status}`)
      return null
    }
    const json = (await res.json()) as { answers?: Record<string, EvaluateAnswer> }
    const out: Record<string, JevDecision | null> = {}
    for (const name of names) {
      const q = questions[name]
      if (!q) continue
      const answer = json.answers?.[name]
      const choice = typeof answer?.choice === 'string' ? answer.choice.trim() : ''
      if (!choice || !q.choices.includes(choice)) {
        out[name] = null
        continue
      }
      const probs = answer?.probabilities
      const p =
        probs && typeof probs === 'object' && !Array.isArray(probs)
          ? Number((probs as Record<string, unknown>)[choice])
          : NaN
      out[name] = {
        choice,
        confidence: Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0.5,
        raw: JSON.stringify(answer).slice(0, 200),
      }
    }
    lastJevError = null
    return out
  } catch {
    warnJevOnce('evaluate-many network/timeout')
    return null
  }
}
const SHOPPING_QUESTION =
  'Is this customer message a TechStore shopping request (products, price, compare, cart, orders, shipping, store policy)?'
export const MERCHANT_QUESTION =
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

// ---------------------------------------------------------------------------
// Generic Score / Noul primitives (Choice đã có ở trên qua jevDecide).
// Cùng contract fail-open + 2 transports: chat JSON ép kiểu, evaluate native.
// ---------------------------------------------------------------------------

export interface JevScore {
  score: number
  confidence: number
  raw: string
}

export interface JevNoul {
  probability: number
  confidence: number
  raw: string
}

const SCORE_CACHE_MAX = 100
const SCORE_CACHE_TTL_MS = 5 * 60_000
const scoreCache = new Map<string, { value: JevScore; at: number }>()
const noulCache = new Map<string, { value: JevNoul; at: number }>()

function scoreCacheKey(question: string, criteria: readonly string[], context: string): string {
  return `score\n${question}\n${criteria.join('|')}\n${context.slice(0, 400)}`
}

function noulCacheKey(statement: string, context: string): string {
  return `noul\n${statement}\n${context.slice(0, 400)}`
}

function cacheGet<T extends { at: number }>(map: Map<string, T>, key: string): T | null {
  const hit = map.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > SCORE_CACHE_TTL_MS) {
    map.delete(key)
    return null
  }
  return hit
}

function cacheSet<T>(map: Map<string, { value: T; at: number }>, key: string, value: T): void {
  if (map.size >= SCORE_CACHE_MAX) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, { value, at: Date.now() })
}

export function parseJevScore(raw: string, max: number): JevScore | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { score?: unknown; confidence?: unknown }
    const s = Number(parsed.score)
    if (!Number.isFinite(s)) return null
    const score = Math.min(max, Math.max(0, Math.round(s)))
    const c = Number(parsed.confidence)
    const confidence = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5
    return { score, confidence, raw: raw.slice(0, 200) }
  } catch {
    return null
  }
}

export function parseJevNoul(raw: string): JevNoul | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { probability?: unknown; confidence?: unknown }
    const p = Number(parsed.probability)
    if (!Number.isFinite(p)) return null
    const probability = Math.min(1, Math.max(0, p))
    const c = Number(parsed.confidence)
    const confidence = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5
    return { probability, confidence, raw: raw.slice(0, 200) }
  } catch {
    return null
  }
}

interface EvaluateScoreAnswer {
  score?: unknown
  confidence?: unknown
  probabilities?: unknown
}

export function parseEvaluateScore(
  answers: Record<string, EvaluateScoreAnswer> | null | undefined,
  max: number,
): JevScore | null {
  const answer = answers?.decision
  const s = Number(answer?.score)
  if (!Number.isFinite(s)) return null
  const score = Math.min(max, Math.max(0, Math.round(s)))
  const c = Number(answer?.confidence)
  const confidence = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5
  return { score, confidence, raw: JSON.stringify(answer).slice(0, 200) }
}

interface EvaluateNoulAnswer {
  probability?: unknown
  noul?: unknown
  score?: unknown
  confidence?: unknown
}

export function parseEvaluateNoul(
  answers: Record<string, EvaluateNoulAnswer> | null | undefined,
): JevNoul | null {
  const answer = answers?.decision
  const raw = answer == null ? NaN : Number(answer.probability ?? answer.noul ?? answer.score)
  if (!Number.isFinite(raw)) return null
  const probability = Math.min(1, Math.max(0, raw))
  const c = Number(answer?.confidence)
  // Boolean evaluate trả {probability} không có confidence — dùng chính
  // probability làm độ tin cậy (noul semantics: p xa 0.5 = chắc).
  const confidence = Number.isFinite(c)
    ? Math.min(1, Math.max(0, c))
    : Math.min(1, Math.max(0, Math.abs(probability - 0.5) * 2))
  return { probability, confidence, raw: JSON.stringify(answer).slice(0, 200) }
}

/**
 * Score một state theo thang 0..max (fail-open → null).
 * Evaluate path dùng native score question; chat path ép JSON {score, confidence}.
 */
export async function jevScore(input: {
  question: string
  criteria: readonly string[]
  context: string
  max?: number
  fetchFn?: typeof fetch
}): Promise<JevScore | null> {
  const apiKey = jevApiKey()
  if (!apiKey) return null
  const { question, criteria, context, fetchFn } = input
  const max = input.max ?? 3
  if (criteria.length === 0) return null
  const key = scoreCacheKey(question, criteria, context)
  const cached = cacheGet(scoreCache, key)
  if (cached) return cached.value
  const doFetch = fetchFn ?? fetch
  if (jevApi() === 'evaluate') {
    try {
      const res = await doFetch(jevEvaluateUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: jevModel(),
          state: `Question: ${question}\nMessage: ${context.slice(0, 800)}`,
          questions: { decision: { type: 'score', instructions: question, criteria } },
        }),
        signal: AbortSignal.timeout(jevTimeoutMs()),
      })
      if (!res.ok) {
        warnJevOnce(`score evaluate HTTP ${res.status}`)
        return null
      }
      const json = (await res.json()) as { answers?: Record<string, EvaluateScoreAnswer> }
      const out = parseEvaluateScore(json.answers, max)
      if (!out) warnJevOnce('score evaluate bad answer')
      else {
        lastJevError = null
        cacheSet(scoreCache, key, out)
      }
      return out
    } catch {
      warnJevOnce('score evaluate network/timeout')
      return null
    }
  }
  try {
    const res = await doFetch(jevUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': gatewayReferer(),
        'X-Title': 'TechStore Jev score',
      },
      body: JSON.stringify({
        model: jevModel(),
        max_tokens: jevMaxTokens(),
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are Jev, a System One decision model. Return typed decisions, never prose. ' +
              `Reply with JSON ONLY: {"score": 0-${max}, "confidence": 0.0-1.0}.`,
          },
          {
            role: 'user',
            content:
              `Question: ${question}\nScale: ${criteria.map((c, i) => `${i}=${c}`).join(' | ')}\n` +
              `Context: ${context.slice(0, 800)}\nReturn JSON only.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(jevTimeoutMs()),
    })
    if (!res.ok) {
      warnJevOnce(`score chat HTTP ${res.status}`)
      return null
    }
    const json = parseJsonPrefix(await res.text()) as {
      choices?: { message?: { content?: string | null } }[]
    }
    const raw = String(json.choices?.[0]?.message?.content ?? '').slice(0, 500)
    if (!raw) {
      warnJevOnce('score chat empty content')
      return null
    }
    const out = parseJevScore(raw, max)
    if (!out) warnJevOnce('score chat bad JSON')
    else {
      lastJevError = null
      cacheSet(scoreCache, key, out)
    }
    return out
  } catch {
    warnJevOnce('score chat network/timeout')
    return null
  }
}

/**
 * Noul: xác suất 0-1 cho một mệnh đề (fail-open → null).
 * Evaluate path dùng native noul question; chat path ép JSON {probability, confidence}.
 */
export async function jevNoul(input: {
  statement: string
  context: string
  fetchFn?: typeof fetch
}): Promise<JevNoul | null> {
  const apiKey = jevApiKey()
  if (!apiKey) return null
  const { statement, context, fetchFn } = input
  const key = noulCacheKey(statement, context)
  const cached = cacheGet(noulCache, key)
  if (cached) return cached.value
  const doFetch = fetchFn ?? fetch
  if (jevApi() === 'evaluate') {
    try {
      const res = await doFetch(jevEvaluateUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: jevModel(),
          state: `Message: ${context.slice(0, 800)}`,
          questions: { decision: { type: 'boolean', statement, instructions: statement } },
        }),
        signal: AbortSignal.timeout(jevTimeoutMs()),
      })
      if (!res.ok) {
        warnJevOnce(`noul evaluate HTTP ${res.status}`)
        return null
      }
      const json = (await res.json()) as { answers?: Record<string, EvaluateNoulAnswer> }
      const out = parseEvaluateNoul(json.answers)
      if (!out) warnJevOnce('noul evaluate bad answer')
      else {
        lastJevError = null
        cacheSet(noulCache, key, out)
      }
      return out
    } catch {
      warnJevOnce('noul evaluate network/timeout')
      return null
    }
  }
  try {
    const res = await doFetch(jevUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': gatewayReferer(),
        'X-Title': 'TechStore Jev noul',
      },
      body: JSON.stringify({
        model: jevModel(),
        max_tokens: jevMaxTokens(),
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are Jev, a System One decision model. Return typed decisions, never prose. ' +
              'Reply with JSON ONLY: {"probability": 0.0-1.0, "confidence": 0.0-1.0}.',
          },
          {
            role: 'user',
            content: `Statement: ${statement}\nContext: ${context.slice(0, 800)}\nReturn JSON only.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(jevTimeoutMs()),
    })
    if (!res.ok) {
      warnJevOnce(`noul chat HTTP ${res.status}`)
      return null
    }
    const json = parseJsonPrefix(await res.text()) as {
      choices?: { message?: { content?: string | null } }[]
    }
    const raw = String(json.choices?.[0]?.message?.content ?? '').slice(0, 500)
    if (!raw) {
      warnJevOnce('noul chat empty content')
      return null
    }
    const out = parseJevNoul(raw)
    if (!out) warnJevOnce('noul chat bad JSON')
    else {
      lastJevError = null
      cacheSet(noulCache, key, out)
    }
    return out
  } catch {
    warnJevOnce('noul chat network/timeout')
    return null
  }
}

// ---------------------------------------------------------------------------
// 5 quyết định sản phẩm trên nền Score/Noul + Choice.
// Tất cả fail-open: nghi ngờ → giá trị an toàn, không bao giờ ném lỗi.
// ---------------------------------------------------------------------------

function includesLower(text: string, terms: readonly string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some((t) => lower.includes(t))
}

// --- 1. Spam / abuse Noul ----------------------------------------------------

const SPAM_TERMS = [
  'casino',
  'cá độ',
  'cá cược',
  'lô đề',
  'số đề',
  'vay nóng',
  'vay nhanh',
  'tín dụng đen',
  'đáo hạn thẻ',
  'tăng like',
  'hack follow',
  'kích dục',
  'bán dâm',
] as const

const SPAM_STATEMENT =
  'Tin nhắn này là spam / quảng cáo rác / lừa đảo, không phải nhu cầu mua sắm thật tại TechStore.'

export const JEV_SPAM_REFUSAL =
  'Tin nhắn này có dấu hiệu spam nên mình xin phép không xử lý. Bạn cần tìm máy gì trong TechStore không?'

export const MERCHANT_SPAM_REFUSAL =
  'Tin nhắn này có dấu hiệu spam nên mình xin phép không xử lý. Bạn cần hỗ trợ vận hành gì không?'

export interface SpamVerdict {
  spam: boolean
  probability: number | null
  source: 'keyword' | 'keyword+jev' | 'disabled'
}

export async function resolveSpamRisk(
  text: string,
  deps?: { fetchFn?: typeof fetch },
): Promise<SpamVerdict> {
  if (includesLower(text, SPAM_TERMS)) return { spam: true, probability: 1, source: 'keyword' }
  if (!isJevEnabled()) return { spam: false, probability: null, source: 'disabled' }
  const out = await jevNoul({ statement: SPAM_STATEMENT, context: text, fetchFn: deps?.fetchFn })
  if (!out || out.confidence < jevThreshold()) {
    return { spam: false, probability: out?.probability ?? null, source: 'keyword' }
  }
  return {
    spam: out.probability >= 0.7,
    probability: out.probability,
    source: 'keyword+jev',
  }
}

// --- 2. Urgency Score --------------------------------------------------------

export type UrgencyLevel = 'low' | 'medium' | 'high'

const URGENT_HIGH_TERMS = [
  'khẩn',
  'gấp lắm',
  'ngay lập tức',
  'hỏng',
  'không dùng được',
  'cháy',
  'mất tiền',
  'bị trừ tiền',
  'khiếu nại',
  'tố cáo',
  'giao thiếu',
  'giao sai',
  'hàng vỡ',
  'lừa',
] as const

const URGENT_MED_TERMS = [
  'gấp',
  'nhanh',
  'sớm',
  'hôm nay',
  'mai cần',
  'cần gấp',
  'đổi trả',
  'hoàn tiền',
  'bảo hành',
  'giao lâu',
  'chậm giao',
] as const

const URGENCY_QUESTION = 'Mức độ khẩn cấp của yêu cầu khách hàng này là bao nhiêu?'
const URGENCY_CRITERIA = ['bình thường', 'cần sớm', 'gấp', 'khiếu nại / sự cố'] as const

export interface UrgencyVerdict {
  level: UrgencyLevel
  score: number | null
  source: 'keyword' | 'keyword+jev' | 'disabled'
}

export async function resolveUrgency(
  text: string,
  deps?: { fetchFn?: typeof fetch },
): Promise<UrgencyVerdict> {
  if (includesLower(text, URGENT_HIGH_TERMS)) return { level: 'high', score: 3, source: 'keyword' }
  if (includesLower(text, URGENT_MED_TERMS)) return { level: 'medium', score: 1, source: 'keyword' }
  if (!isJevEnabled()) return { level: 'low', score: null, source: 'disabled' }
  const out = await jevScore({
    question: URGENCY_QUESTION,
    criteria: URGENCY_CRITERIA,
    context: text,
    max: 3,
    fetchFn: deps?.fetchFn,
  })
  if (!out || out.confidence < jevThreshold()) {
    return { level: 'low', score: out?.score ?? null, source: 'keyword' }
  }
  return {
    level: out.score >= 2 ? 'high' : out.score >= 1 ? 'medium' : 'low',
    score: out.score,
    source: 'keyword+jev',
  }
}

// --- 3. Fraud text signal → cộng hưởng với risk.ts ----------------------------

const FRAUD_HINT_TERMS = [
  'chuyển khoản trước',
  'cọc trước',
  'thanh toán hộ',
  'otp',
  'mã xác minh',
  'giao ngoài sàn',
  'không qua techstore',
  'hoàn tiền ngoài',
  'xuất hóa đơn khác',
] as const

const FRAUD_STATEMENT =
  'Nội dung trao đổi này có dấu hiệu gian lận / lừa đảo / chiếm đoạt cần xác minh trước khi xử lý đơn.'

export interface FraudSignal {
  probability: number | null
  source: 'keyword' | 'keyword+jev' | 'disabled'
}

export async function resolveFraudSignal(
  text: string,
  deps?: { fetchFn?: typeof fetch },
): Promise<FraudSignal> {
  if (includesLower(text, FRAUD_HINT_TERMS)) {
    return { probability: 0.85, source: 'keyword' }
  }
  if (!isJevEnabled()) return { probability: null, source: 'disabled' }
  const out = await jevNoul({ statement: FRAUD_STATEMENT, context: text, fetchFn: deps?.fetchFn })
  if (!out) return { probability: null, source: 'keyword' }
  return { probability: out.probability, source: 'keyword+jev' }
}

/**
 * Cộng hưởng rule-engine với tín hiệu text: rule giữ vai trò quyết định,
 * JEV chỉ thêm tối đa 1 factor +20 khi prob vượt ngưỡng. Fail-soft → base.
 */
export async function assessOrderRiskWithJev(
  input: OrderRiskInput,
  text: string,
  deps?: { fetchFn?: typeof fetch },
): Promise<{ assessment: RiskAssessment; fraud: FraudSignal }> {
  const { assessOrderRisk } = await import('./risk')
  const base = assessOrderRisk(input)
  const fraud = await resolveFraudSignal(text, deps)
  const prob = fraud.probability ?? 0
  if (prob < jevThreshold() || !text.trim()) return { assessment: base, fraud }
  const factors = [
    ...base.factors,
    { code: 'text_fraud_signal', label: 'Nội dung trao đổi có dấu hiệu gian lận', weight: 20 },
  ]
  const score = Math.min(100, factors.reduce((sum, f) => sum + f.weight, 0))
  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  const recommendation =
    level === 'high'
      ? 'Giữ đơn, liên hệ xác minh trước khi xử lý. Agent không tự xử lý đơn rủi ro cao.'
      : level === 'medium'
        ? 'Kiểm tra nhanh thông tin liên hệ rồi mới xử lý; agent chỉ được đề xuất, người vận hành chốt.'
        : base.recommendation
  return { assessment: { level, score, factors, recommendation }, fraud }
}

// --- 4. Model routing: simple / medium / hard ---------------------------------

export type ModelTier = 'simple' | 'medium' | 'hard'

const ROUTER_CHOICES = ['simple', 'medium', 'hard'] as const
const ROUTER_QUESTION =
  'How hard is this TechStore request? ' +
  'simple=greeting / one product / price lookup, ' +
  'medium=compare / complaint / order tracking / light analysis, ' +
  'hard=multi-constraint / deep technical / dispute / staging changes.'

const ROUTER_RISK_TERMS = [
  'production',
  'delete',
  'migration',
  'security',
  'payment',
  'thanh toán',
  'hoàn tiền',
  'xóa',
  'xoá',
  'bảo mật',
  'pháp lý',
  'kiện',
  'hợp đồng',
  'duyệt',
  'áp dụng',
  'refund',
] as const

export function isJevRoutingEnabled(): boolean {
  if (process.env.JEV_ROUTING === '0') return false
  return isJevEnabled()
}

function envName(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : undefined
}

export interface TierVerdict {
  tier: ModelTier
  confidence: number | null
  source: 'keyword' | 'jev' | 'disabled'
}

export async function resolveModelTier(
  text: string,
  deps?: { fetchFn?: typeof fetch },
): Promise<TierVerdict> {
  // No tier models configured → routing changes nothing, skip the Jev call.
  if (!envName('ASSISTANT_SIMPLE_MODEL') && !envName('ASSISTANT_HARD_MODEL')) {
    return { tier: 'medium', confidence: null, source: 'disabled' }
  }
  const risky = includesLower(text, ROUTER_RISK_TERMS)
  if (!isJevRoutingEnabled()) return { tier: 'medium', confidence: null, source: 'disabled' }
  // Short harmless turns never need the expensive tier — skip the gateway.
  if (!risky && text.trim().length < 40) return { tier: 'simple', confidence: null, source: 'keyword' }
  const decision = await jevDecide({
    question: ROUTER_QUESTION,
    choices: ROUTER_CHOICES,
    context: text,
    fetchFn: deps?.fetchFn,
  })
  if (!decision || decision.confidence < jevThreshold()) {
    return { tier: risky ? 'medium' : 'simple', confidence: decision?.confidence ?? null, source: 'keyword' }
  }
  const tier = decision.choice as ModelTier
  // Risk words set a floor of medium, never buy hard alone.
  if (risky && tier === 'simple') return { tier: 'medium', confidence: decision.confidence, source: 'jev' }
  return { tier, confidence: decision.confidence, source: 'jev' }
}

/**
 * Chọn model cho turn từ tier. simple → ASSISTANT_SIMPLE_MODEL (nếu có),
 * hard → ASSISTANT_HARD_MODEL (nếu có), còn lại giữ primary. Fail-open primary.
 */
export function selectRoutedModel(primary: string, tier: ModelTier): string {
  if (tier === 'simple') return envName('ASSISTANT_SIMPLE_MODEL') ?? primary
  if (tier === 'hard') return envName('ASSISTANT_HARD_MODEL') ?? primary
  return primary
}

// --- 6. Pre-turn batch: spam + scope + tier trong 1 evaluate call -------------

/**
 * Một `/v1/evaluate` request cho toàn bộ quyết định đầu turn (spam noul →
 * choice 2-way, scope 3-way, tier 3-way). Chỉ chạy trên evaluate path; chat
 * path rớt về call lẻ từng cái. Fail-open toàn bộ → null, caller fallback
 * sequential. Bỏ qua tier nếu routing tắt, bỏ qua scope nếu keyword đã
 * in-scope — caller chỉ gửi phần cần.
 */
export interface PreTurnDecisions {
  spam: JevDecision | null
  scope: JevDecision | null
}

export async function resolvePreTurn(input: {
  text: string
  needSpam?: boolean
  needScope?: boolean
  scopeQuestion?: string
  fetchFn?: typeof fetch
}): Promise<PreTurnDecisions | null> {
  if (jevApi() !== 'evaluate') return null
  const questions: Record<string, { instructions: string; choices: readonly string[] }> = {}
  if (input.needSpam) {
    questions.spam = {
      instructions: 'Is this message spam / junk advertising / scam, not a real TechStore need?',
      choices: ['spam', 'not-spam'] as const,
    }
  }
  if (input.needScope) {
    questions.scope = {
      instructions: input.scopeQuestion ?? SHOPPING_QUESTION,
      choices: ['in-scope', 'gray', 'off-topic'] as const,
    }
  }
  if (Object.keys(questions).length === 0) return { spam: null, scope: null }
  const answers = await jevDecideMany({ questions, context: input.text, fetchFn: input.fetchFn })
  if (!answers) return null
  return {
    spam: answers.spam ?? null,
    scope: answers.scope ?? null,
  }
}

// --- 5. Memory gate: có đáng tốn 1 model call trích xuất? -----------------------

const MEMORY_HINT_TERMS = [
  'ngân sách',
  'triệu',
  'tỷ',
  'tầm giá',
  'dưới ',
  'thương hiệu',
  'apple',
  'samsung',
  'dell',
  'asus',
  'gaming',
  'đồ họa',
  'do hoa',
  'văn phòng',
  'sinh viên',
  'lập trình',
  'pin trâu',
] as const

const MEMORY_STATEMENT =
  'Đoạn chat chứa sở thích mua sắm lâu dài đáng lưu (ngân sách / nhu cầu sử dụng / thương hiệu ưa thích).'

export interface MemoryGate {
  useModel: boolean
  probability: number | null
  source: 'keyword' | 'keyword+jev' | 'disabled'
}

export async function shouldUseModelMemory(
  userTexts: string[],
  deps?: { fetchFn?: typeof fetch },
): Promise<MemoryGate> {
  const joined = userTexts.join('\n')
  if (!joined.trim()) return { useModel: false, probability: null, source: 'keyword' }
  if (includesLower(joined, MEMORY_HINT_TERMS)) {
    return { useModel: true, probability: 1, source: 'keyword' }
  }
  if (!isJevEnabled()) return { useModel: false, probability: null, source: 'disabled' }
  const out = await jevNoul({ statement: MEMORY_STATEMENT, context: joined, fetchFn: deps?.fetchFn })
  if (!out || out.confidence < jevThreshold()) {
    return { useModel: false, probability: out?.probability ?? null, source: 'keyword' }
  }
  return { useModel: out.probability >= 0.6, probability: out.probability, source: 'keyword+jev' }
}

