/**
 * Chat memory (port of commerce-agents memory extraction, Messages-API path:
 * `update_memory` after the turn). Rule-based v1: no extra model call, only
 * durable shopping preferences (budget, use-cases, brands). Phones and other
 * PII are never stored (memory validation).
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { hashToken } from '@/lib/commerce/tokens'

export interface MemoryFacts {
  budget_vnd?: number
  use_cases?: string[]
  brands?: string[]
}

const MAX_FACT_CHARS = 2000

const USE_CASE_LEXICON: Array<{ test: RegExp; value: string }> = [
  { test: /học|học tập|sinh viên|văn phòng|office/i, value: 'học tập / văn phòng' },
  { test: /game|gaming|chơi game|esport/i, value: 'gaming' },
  { test: /đồ họa|thiết kế|render|video|edit/i, value: 'đồ họa / sáng tạo' },
  { test: /lập trình|code|developer|it\b/i, value: 'lập trình' },
  { test: /nghe nhạc|âm thanh|loa|tai nghe/i, value: 'âm thanh' },
  { test: /chụp ảnh|quay|vlog|content/i, value: 'chụp ảnh / quay video' },
]

const BRAND_LEXICON = ['apple', 'samsung', 'dell', 'asus', 'xiaomi', 'sony', 'jbl', 'lenovo', 'hp', 'acer', 'msi', 'gigabyte', 'logitech']

/** Never persist anything phone/email/ID-like (memory validation). */
export function containsPhoneLike(text: string): boolean {
  return /(^|\D)0\d{8,10}(\D|$)/.test(text)
}

export function containsSensitivePii(text: string): boolean {
  if (containsPhoneLike(text)) return true
  // email, CCCD 12 số, số tài khoản/ví dài
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return true
  if (/(^|\D)\d{12}(\D|$)/.test(text)) return true
  if (/(^|\D)\d{13,19}(\D|$)/.test(text)) return true
  return false
}

function parseBudgetVnd(text: string): number | null {
  const match = text.match(/(\d[\d.,]*)\s*(tỷ|ty|triệu|trieu|tr|củ|k|nghìn|nghin|đ|vnd|₫)/i)
  if (!match) return null
  const amount = Number(match[1].replace(/[.,]/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = match[2].toLowerCase()
  if (unit.startsWith('tỷ') || unit === 'ty') return amount * 1_000_000_000
  if (/triệu|trieu|^tr$|củ/.test(unit)) return amount * 1_000_000
  if (unit === 'k' || unit.startsWith('ngh')) return amount * 1000
  return amount
}

/** Extract durable shopping prefs from user messages (rule-based v1). */
export function extractMemoryFacts(userTexts: string[]): MemoryFacts {
  const facts: MemoryFacts = {}
  const useCases = new Set<string>()
  const brands = new Set<string>()
  for (const text of userTexts) {
    if (containsPhoneLike(text)) continue
    const budget = parseBudgetVnd(text)
    if (budget && budget >= 500_000 && budget <= 500_000_000) facts.budget_vnd = budget
    for (const { test, value } of USE_CASE_LEXICON) {
      if (test.test(text)) useCases.add(value)
    }
    const lower = text.toLowerCase()
    for (const brand of BRAND_LEXICON) {
      if (lower.includes(brand)) brands.add(brand)
    }
  }
  if (useCases.size > 0) facts.use_cases = [...useCases].slice(0, 5)
  if (brands.size > 0) facts.brands = [...brands].slice(0, 5)
  return facts
}

export function mergeFacts(base: MemoryFacts, next: MemoryFacts): MemoryFacts {
  const merged: MemoryFacts = {}
  const budget = next.budget_vnd ?? base.budget_vnd
  if (budget != null) merged.budget_vnd = budget
  const useCases = [...new Set([...(base.use_cases ?? []), ...(next.use_cases ?? [])])].slice(0, 5)
  if (useCases.length > 0) merged.use_cases = useCases
  const brands = [...new Set([...(base.brands ?? []), ...(next.brands ?? [])])].slice(0, 5)
  if (brands.length > 0) merged.brands = brands
  return merged
}

export type MemoryDb = {
  from: (table: string) => {
    select: (cols: string) => { eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } }
    upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ error: unknown }>
  }
}

export async function sessionKeyHash(sessionId: string): Promise<string | null> {
  const id = sessionId.trim().slice(0, 128)
  if (id.length < 8) return null
  return hashToken(id)
}

export async function loadMemoryFacts(
  sessionKey: string,
  db?: MemoryDb,
): Promise<MemoryFacts> {
  try {
    const client = (db ?? getSupabaseAdminClient()) as unknown as MemoryDb
    const { data, error } = await client.from('customer_memories').select('facts').eq('session_key', sessionKey).maybeSingle()
    if (error || !data || typeof data !== 'object' || !('facts' in data)) return {}
    const facts = (data as { facts: unknown }).facts
    if (!facts || typeof facts !== 'object') return {}
    return facts as MemoryFacts
  } catch {
    return {}
  }
}

/** Merge-and-store extracted facts. Never throws (fail-closed, chat continues). */
export async function updateMemory(
  sessionKey: string,
  userTexts: string[],
  db?: MemoryDb,
): Promise<MemoryFacts> {  const next = extractMemoryFacts(userTexts)
  if (Object.keys(next).length === 0) return loadMemoryFacts(sessionKey, db)
  try {
    const client = (db ?? getSupabaseAdminClient()) as unknown as MemoryDb
    const base = await loadMemoryFacts(sessionKey, db)
    const merged = mergeFacts(base, next)
    if (JSON.stringify(merged).length > MAX_FACT_CHARS) return base
    const { error } = await client
      .from('customer_memories')
      .upsert({ session_key: sessionKey, facts: merged, updated_at: new Date().toISOString() }, { onConflict: 'session_key' })
    if (error) return base
    return merged
  } catch {
    return {}
  }
}

// -- Model-driven extraction (update_memory, Messages-API path only) --------

/**
 * Structural subset of MessagesClient used for the single post-turn
 * extraction call. The real provider client (Anthropic or DeepSeek) is
 * assignable to this interface.
 */
export interface MemoryModelClient {
  messages: {
    create(params: {
      model: string
      max_tokens: number
      system: string
      messages: { role: 'user' | 'assistant'; content: string }[]
      tools: never[]
      tool_choice: { type: 'none' }
    }): Promise<{
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >
    }>
  }
}

const MEMORY_EXTRACTION_SYSTEM =
  'Trích xuất sở thích mua sắm lâu dài từ đoạn chat. ' +
  'Chỉ trả về JSON thuần (không code fence, không giải thích) với các khóa tùy chọn: ' +
  '{"budget_vnd": số nguyên VND, "use_cases": ["nhu cầu", ...], "brands": ["thương hiệu", ...]}. ' +
  'Bỏ qua số điện thoại, tên, địa chỉ và mọi thông tin định danh — không bao giờ đưa chúng vào JSON. ' +
  'Không suy đoán: khóa nào không có bằng chứng rõ thì bỏ. Ví dụ: {}.'

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().slice(0, 80))
    .filter((v) => v.length > 0 && !containsSensitivePii(v))
    .slice(0, 5)
}

/** Validate + sanitize one model-produced extraction payload. Never throws. */
export function parseMemoryExtractionJson(raw: unknown): MemoryFacts {
  const facts: MemoryFacts = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return facts
  const obj = raw as Record<string, unknown>
  const budget = Number(obj.budget_vnd)
  if (Number.isFinite(budget) && budget >= 500_000 && budget <= 500_000_000) {
    facts.budget_vnd = Math.floor(budget)
  }
  const useCases = cleanStringList(obj.use_cases)
  if (useCases.length > 0) facts.use_cases = useCases
  const brands = cleanStringList(obj.brands).map((b) => b.toLowerCase())
  if (brands.length > 0) facts.brands = brands
  return facts
}

function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return (match ? match[1] : text).trim()
}

/**
 * Post-turn model extraction: 1 extra call with the recent user transcript.
 * Phone-like texts never enter the prompt; the JSON answer still passes
 * parseMemoryExtractionJson + the 2000-char cap. Never throws.
 */
export async function updateMemoryWithModel(
  sessionKey: string,
  userTexts: string[],
  client: MemoryModelClient,
  model: string,
  db?: MemoryDb,
): Promise<MemoryFacts> {
  try {
    const base = await loadMemoryFacts(sessionKey, db)
    const clean = userTexts.filter((t) => !containsSensitivePii(t)).slice(-6).join('\n').slice(0, 4000)
    if (!clean.trim()) return base
    const response = await client.messages.create({
      model,
      max_tokens: 256,
      system: MEMORY_EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: clean }],
      tools: [],
      tool_choice: { type: 'none' },
    })
    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
    let parsed: unknown = null
    try {
      parsed = JSON.parse(stripCodeFence(text))
    } catch {
      return base
    }
    const next = parseMemoryExtractionJson(parsed)
    if (Object.keys(next).length === 0) return base
    const merged = mergeFacts(base, next)
    if (JSON.stringify(merged).length > MAX_FACT_CHARS) return base
    const store = (db ?? getSupabaseAdminClient()) as unknown as MemoryDb
    const { error } = await store
      .from('customer_memories')
      .upsert({ session_key: sessionKey, facts: merged, updated_at: new Date().toISOString() }, { onConflict: 'session_key' })
    if (error) return base
    return merged
  } catch {
    try {
      return await loadMemoryFacts(sessionKey, db)
    } catch {
      return {}
    }
  }
}
