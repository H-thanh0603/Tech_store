/**
 * Staging + approved execution (port of the propose → preview → approve →
 * apply flow). Staging only reads; execution calls the existing product
 * Server Actions so audit logging and permission checks stay in one place.
 */

import { formatPrice } from '@/lib/format'
import { bulkAdjustPrice, bulkSetStock, bulkUpdateProducts } from '@/lib/admin/products'
import type { AdminActionState } from '@/lib/admin/types'

import { getListing, liveStates } from './backend'
import {
  checkGuardrails,
  nextChangeId,
  projectedPrice,
  signChange,
  verifySignedChange,
  type PriceAction,
  type PublishAction,
  type SignedChange,
  type StagedChange,
  type StagedItemPreview,
  type StockAction,
} from './guardrails'

const INITIAL_STATE: AdminActionState = { ok: true }

function formDataWithIds(productIds: string[], extra?: Record<string, string>): FormData {
  const fd = new FormData()
  for (const id of productIds) fd.append('productIds', id)
  if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return fd
}

function publishPreview(
  target: PublishAction['target'],
  seen: Map<string, { name: string; isPublished: boolean; isArchived: boolean }>,
  ids: string[],
): StagedItemPreview[] {
  const after =
    target === 'publish' ? 'Đã xuất bản' : target === 'draft' ? 'Bản nháp' : 'Đã lưu trữ'
  return ids.map((id) => {
    const s = seen.get(id)
    const before = !s ? '?' : s.isArchived ? 'Đã lưu trữ' : s.isPublished ? 'Đã xuất bản' : 'Bản nháp'
    return { productId: id, name: s?.name ?? id, before, after }
  })
}

export async function stagePublish(
  target: PublishAction['target'],
  productIds: string[],
  note: string | null,
): Promise<{ change?: SignedChange; violations?: string[] }> {
  const ids = [...new Set(productIds)].slice(0, 50)
  const action: PublishAction = { kind: 'publish', target, productIds: ids }
  const live = await liveStates(ids)
  const seen = new Map<string, { name: string; isPublished: boolean; isArchived: boolean }>()
  await Promise.all(
    ids.map(async (id) => {
      const d = await getListing(id)
      if (d) seen.set(id, { name: d.name, isPublished: d.isPublished, isArchived: d.isArchived })
    }),
  )
  const check = checkGuardrails(action, live)
  if (!check.ok) return { violations: check.violations }
  const verb = target === 'publish' ? 'Xuất bản' : target === 'draft' ? 'Chuyển sang nháp' : 'Lưu trữ'
  const change: StagedChange = {
    id: nextChangeId(),
    kind: 'publish',
    summary: `${verb} ${ids.length} sản phẩm`,
    note,
    action,
    items: publishPreview(target, seen, ids),
    createdAt: new Date().toISOString(),
  }
  return { change: signChange(change) }
}

export async function stagePrice(
  productIds: string[],
  mode: PriceAction['mode'],
  value: number,
  note: string | null,
): Promise<{ change?: SignedChange; violations?: string[] }> {
  const ids = [...new Set(productIds)].slice(0, 50)
  const action: PriceAction = { kind: 'price', productIds: ids, mode, value }
  const live = await liveStates(ids)
  const check = checkGuardrails(action, live)
  if (!check.ok) return { violations: check.violations }
  const items: StagedItemPreview[] = ids.map((id) => {
    const state = live.get(id)
    const before = state ? formatPrice(state.minPrice) : '?'
    const after =
      mode === 'set_sale_off'
        ? 'Tắt giá sale (về giá gốc)'
        : state
          ? formatPrice(Math.round(projectedPrice(state.minPrice, action) ?? 0))
          : '?'
    return { productId: id, name: state?.name ?? id, before, after }
  })
  const label =
    mode === 'percent_up'
      ? `Tăng giá ${value}%`
      : mode === 'percent_down'
        ? `Giảm giá ${value}%`
        : 'Tắt giá sale'
  const change: StagedChange = {
    id: nextChangeId(),
    kind: 'price',
    summary: `${label} — ${ids.length} sản phẩm`,
    note,
    action,
    items,
    createdAt: new Date().toISOString(),
  }
  return { change: signChange(change) }
}

export async function stageStock(
  productIds: string[],
  quantity: number,
  note: string | null,
): Promise<{ change?: SignedChange; violations?: string[] }> {
  const ids = [...new Set(productIds)].slice(0, 50)
  const action: StockAction = { kind: 'stock', productIds: ids, quantity }
  const live = await liveStates(ids)
  const check = checkGuardrails(action, live)
  if (!check.ok) return { violations: check.violations }
  const change: StagedChange = {
    id: nextChangeId(),
    kind: 'stock',
    summary: `Đặt tồn kho ${quantity} — ${ids.length} sản phẩm`,
    note,
    action,
    items: ids.map((id) => {
      const state = live.get(id)
      return {
        productId: id,
        name: state?.name ?? id,
        before: state ? String(state.availableStock) : '?',
        after: String(quantity),
      }
    }),
    createdAt: new Date().toISOString(),
  }
  return { change: signChange(change) }
}

export interface ApplyResult {
  ok: boolean
  message: string
}

/**
 * Execute an approved staged change. Verifies the envelope signature,
 * re-checks guardrails against LIVE state (prices may have moved since
 * staging), then runs the existing Server Action (audit included).
 */
export async function applySignedChange(signed: SignedChange): Promise<ApplyResult> {
  if (!verifySignedChange(signed)) {
    return { ok: false, message: 'Chữ ký change không hợp lệ — change có thể đã bị sửa. Hãy stage lại.' }
  }
  const { action } = signed.change
  const live = await liveStates(action.productIds)
  const check = checkGuardrails(action, live)
  if (!check.ok) {
    return { ok: false, message: `Không áp dụng được: ${check.violations.join(' ')}` }
  }

  let state: AdminActionState
  if (action.kind === 'publish') {
    const bulkAction = action.target === 'publish' ? 'publish' : action.target === 'draft' ? 'draft' : 'archive'
    state = await bulkUpdateProducts(INITIAL_STATE, formDataWithIds(action.productIds, { bulkAction }))
  } else if (action.kind === 'price') {
    state = await bulkAdjustPrice(
      INITIAL_STATE,
      formDataWithIds(action.productIds, {
        bulkAction: action.mode,
        bulkValue: action.mode === 'set_sale_off' ? '' : String(action.value),
      }),
    )
  } else {
    state = await bulkSetStock(
      INITIAL_STATE,
      formDataWithIds(action.productIds, { bulkValue: String(action.quantity) }),
    )
  }
  if (!state.ok) {
    return { ok: false, message: state.message || 'Áp dụng thất bại.' }
  }
  return { ok: true, message: state.message || 'Đã áp dụng.' }
}
