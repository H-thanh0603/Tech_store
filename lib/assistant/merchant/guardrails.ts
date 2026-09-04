/**
 * Staged-change types + guardrails (port of `commerce-agents` changes.py,
 * pilot subset). Staging NEVER writes: it validates against live reads and
 * returns a signed envelope. Apply re-validates before executing.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import { merchantConfig } from './config'

export type StagedKind = 'publish' | 'price' | 'stock'

export interface PublishAction {
  kind: 'publish'
  /** publish | draft | archive */
  target: 'publish' | 'draft' | 'archive'
  productIds: string[]
}

export interface PriceAction {
  kind: 'price'
  productIds: string[]
  mode: 'percent_up' | 'percent_down' | 'set_sale_off'
  /** Percent 1..100 for percent_*; ignored for set_sale_off. */
  value: number
}

export interface StockAction {
  kind: 'stock'
  productIds: string[]
  quantity: number
}

export type StagedAction = PublishAction | PriceAction | StockAction

export interface StagedItemPreview {
  productId: string
  name: string
  before: string
  after: string
}

export interface StagedChange {
  id: string
  kind: StagedKind
  summary: string
  note: string | null
  action: StagedAction
  items: StagedItemPreview[]
  createdAt: string
}

export interface GuardrailCheck {
  ok: boolean
  violations: string[]
}

/** Live price/stock snapshot the guardrails check against. */
export interface LiveItemState {
  productId: string
  name: string
  /** Current minimum (sale-or-regular) price across active variants. */
  minPrice: number
  availableStock: number
}

function pctChange(before: number, after: number): number {
  if (before <= 0) return Number.POSITIVE_INFINITY
  return (Math.abs(after - before) / before) * 100
}

export function projectedPrice(before: number, action: PriceAction): number | null {
  if (action.mode === 'set_sale_off') return before
  if (!Number.isFinite(action.value) || action.value <= 0 || action.value > 100) return null
  const factor = action.value / 100
  return action.mode === 'percent_up' ? before * (1 + factor) : before * (1 - factor)
}

export function checkGuardrails(
  action: StagedAction,
  live: Map<string, LiveItemState>,
): GuardrailCheck {
  const violations: string[] = []
  const cfg = merchantConfig
  const ids = action.productIds

  if (ids.length === 0) violations.push('Change trống: chọn ít nhất một sản phẩm.')
  if (ids.length > cfg.maxItemsPerChange) {
    violations.push(
      `Change chạm ${ids.length} sản phẩm, giới hạn ${cfg.maxItemsPerChange}/change — tách thành nhiều change, mỗi change duyệt riêng.`,
    )
  }
  if (new Set(ids).size !== ids.length) {
    violations.push('Một sản phẩm xuất hiện 2 lần trong change — mỗi dòng một sản phẩm.')
  }
  for (const id of ids) {
    if (!live.has(id)) {
      violations.push(`Sản phẩm ${id} chưa được đọc từ catalog trong cuộc trò chuyện — search trước khi stage.`)
    }
  }
  if (action.kind === 'price') {
    for (const id of ids) {
      const state = live.get(id)
      if (!state) continue
      const after = projectedPrice(state.minPrice, action)
      if (after === null || after < 0) {
        violations.push(`Giá sau thay đổi của ${state.name} không hợp lệ.`)
        continue
      }
      const delta = pctChange(state.minPrice, after)
      if (delta > cfg.maxPriceDeltaPct) {
        violations.push(
          `Giá ${state.name} đổi ${delta.toFixed(0)}%, vượt giới hạn ${cfg.maxPriceDeltaPct}%/change.`,
        )
      }
    }
  }
  if (action.kind === 'stock') {
    if (!Number.isInteger(action.quantity) || action.quantity < 0 || action.quantity > 1_000_000) {
      violations.push('Số lượng tồn phải là số nguyên từ 0 đến 1.000.000.')
    }
    for (const id of ids) {
      const state = live.get(id)
      if (!state) continue
      const added = action.quantity - state.availableStock
      if (added > cfg.maxRestockQuantity) {
        violations.push(
          `Nhập thêm ${added} đơn vị cho ${state.name}, vượt giới hạn ${cfg.maxRestockQuantity}/change.`,
        )
      }
    }
  }
  return { ok: violations.length === 0, violations }
}

// -- Signed envelope (stateless staging) -------------------------------------

function stagingSecret(): string {
  const secret = process.env.ASSISTANT_STAGING_SECRET
  if (secret) return secret
  // Fail loud in production: stagings signed with a well-known dev secret
  // would be forgeable. Staging refuses; reads keep working.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ASSISTANT_STAGING_SECRET is required in production.')
  }
  return 'dev-only-staging-secret-change-me'
}

function canonical(change: StagedChange): string {
  return JSON.stringify({
    id: change.id,
    kind: change.kind,
    summary: change.summary,
    note: change.note,
    action: change.action,
    items: change.items,
    createdAt: change.createdAt,
  })
}

export interface SignedChange {
  change: StagedChange
  signature: string
}

export function signChange(change: StagedChange): SignedChange {
  const signature = createHmac('sha256', stagingSecret()).update(canonical(change)).digest('hex')
  return { change, signature }
}

export function verifySignedChange(signed: SignedChange): boolean {
  try {
    const expected = createHmac('sha256', stagingSecret()).update(canonical(signed.change)).digest()
    const actual = Buffer.from(signed.signature, 'hex')
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

let sequence = 0

export function nextChangeId(): string {
  sequence += 1
  return `chg-${Date.now().toString(36)}-${sequence.toString().padStart(3, '0')}`
}
