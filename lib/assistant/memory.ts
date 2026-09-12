/**
 * Chat memory (port of commerce-agents memory extraction, Messages-API path:
 * `update_memory` after the turn). Rule-based v1: no extra model call, only
 * durable shopping preferences (budget, use-cases, brands). Phones and other
 * PII are never stored (memory validation).
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { sha256Hex } from '@/lib/commerce/tokens'

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

/** Never persist anything phone-like (memory validation). */
export function containsPhoneLike(text: string): boolean {
  return /(^|\D)0\d{8,10}(\D|$)/.test(text)
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
  return sha256Hex(id)
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
): Promise<MemoryFacts> {
  const next = extractMemoryFacts(userTexts)
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
