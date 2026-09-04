/**
 * Merchant tool contracts (port of `commerce-agents` merchant tools/registry,
 * pilot subset). Reads + stage_* only — the model has NO apply tool.
 * Approval and execution happen on the host approval surface (admin UI).
 */

import type Anthropic from '@anthropic-ai/sdk'

import {
  businessSnapshot,
  getListing,
  inventoryAlerts,
  orderIssues,
  searchListings,
} from './backend'
import { fencePayload } from '../fencing'
import { merchantConfig } from './config'
import { stagePrice, stagePublish, stageStock } from './stage'
import { listPendingStaged } from './ledger'
import type { SignedChange } from './guardrails'

export const TOOL_SNAPSHOT = 'get_business_snapshot'
export const TOOL_ALERTS = 'get_inventory_alerts'
export const TOOL_ORDER_ISSUES = 'get_order_issues'
export const TOOL_SEARCH_LISTINGS = 'search_listings'
export const TOOL_GET_LISTING = 'get_listing'
export const TOOL_GET_PRICING = 'get_pricing_context'
export const TOOL_STAGE_PUBLISH = 'stage_publish_change'
export const TOOL_STAGE_PRICE = 'stage_price_change'
export const TOOL_STAGE_STOCK = 'stage_stock_change'
export const TOOL_PENDING = 'get_pending_changes'
export const TOOL_PRESENT_SUGGESTIONS = 'present_suggestions'

export interface MerchantDispatchContext {
  seenListingIds: Set<string>
  stagedIds: string[]
  suggestions: string[]
  endTurn: boolean
  actorUserId: string | null
}

export function createMerchantContext(actorUserId: string | null = null): MerchantDispatchContext {
  return { seenListingIds: new Set(), stagedIds: [], suggestions: [], endTurn: false, actorUserId }
}

export function buildMerchantTools(): Anthropic.Tool[] {
  const cfg = merchantConfig
  const tools: Anthropic.Tool[] = [
    {
      name: TOOL_SNAPSHOT,
      description: 'Số liệu tổng quan 7 ngày: doanh thu, đơn mới, đơn chờ xử lý, hàng sắp hết, sản phẩm nháp. Gọi trước khi nhận xét hiệu quả kinh doanh.',
      input_schema: { type: 'object' as const, properties: {} },
    },
    {
      name: TOOL_SEARCH_LISTINGS,
      description: 'Tìm sản phẩm trong catalog admin theo tên/SKU. Id trả về dùng cho get_listing và stage change.',
      input_schema: {
        type: 'object' as const,
        properties: { query: { type: 'string', description: 'Từ khóa tên hoặc SKU' } },
        required: ['query'],
      },
    },
    {
      name: TOOL_GET_LISTING,
      description: 'Chi tiết một sản phẩm: trạng thái xuất bản, biến thể, giá, tồn kho.',
      input_schema: {
        type: 'object' as const,
        properties: { product_id: { type: 'string', description: 'Id sản phẩm' } },
        required: ['product_id'],
      },
    },
    {
      name: TOOL_GET_PRICING,
      description: 'Bối cảnh giá một sản phẩm: giá từng biến thể để tính mức điều chỉnh.',
      input_schema: {
        type: 'object' as const,
        properties: { product_id: { type: 'string' } },
        required: ['product_id'],
      },
    },
  ]
  if (cfg.enableInventory) {
    tools.push(
      {
        name: TOOL_ALERTS,
        description: 'Cảnh báo tồn kho: hết hàng và sắp hết, kèm ngưỡng.',
        input_schema: { type: 'object' as const, properties: {} },
      },
      {
        name: TOOL_ORDER_ISSUES,
        description: 'Đơn hàng đang mở cần xử lý: pending và awaiting_payment, cũ nhất trước.',
        input_schema: { type: 'object' as const, properties: {} },
      },
    )
  }
  if (cfg.enableListingReads || cfg.enablePricing) {
    tools.push({
      name: TOOL_STAGE_PUBLISH,
      description:
        'Stage thay đổi xuất bản (publish/draft/archive) cho sản phẩm ĐÃ ĐỌC trong cuộc trò chuyện. Chỉ stage, không áp dụng — người vận hành duyệt trên nút Duyệt.',
      input_schema: {
        type: 'object' as const,
        properties: {
          target: { type: 'string', enum: ['publish', 'draft', 'archive'] },
          product_ids: { type: 'array', items: { type: 'string' } },
          note: { type: 'string', description: 'Ghi chú giả định cho người duyệt' },
        },
        required: ['target', 'product_ids'],
      },
    })
  }
  if (cfg.enablePricing) {
    tools.push({
      name: TOOL_STAGE_PRICE,
      description:
        'Stage điều chỉnh giá theo % cho sản phẩm ĐÃ ĐỌC (percent_up/percent_down 1-100, hoặc set_sale_off để tắt sale). Giới hạn 20%/change. Chỉ stage, không áp dụng.',
      input_schema: {
        type: 'object' as const,
        properties: {
          product_ids: { type: 'array', items: { type: 'string' } },
          mode: { type: 'string', enum: ['percent_up', 'percent_down', 'set_sale_off'] },
          value: { type: 'number', description: 'Phần trăm 1-100' },
          note: { type: 'string' },
        },
        required: ['product_ids', 'mode'],
      },
    })
  }
  if (cfg.enableInventory) {
    tools.push({
      name: TOOL_STAGE_STOCK,
      description: 'Stage đặt tồn kho (số nguyên 0-1.000.000) cho sản phẩm ĐÃ ĐỌC. Chỉ stage, không áp dụng.',
      input_schema: {
        type: 'object' as const,
        properties: {
          product_ids: { type: 'array', items: { type: 'string' } },
          quantity: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['product_ids', 'quantity'],
      },
    })
  }
  tools.push({
    name: TOOL_PENDING,
    description: 'Liệt kê change đang chờ duyệt (đã stage nhưng chưa áp dụng/bỏ).',
    input_schema: { type: 'object' as const, properties: {} },
  })
  tools.push({
    name: TOOL_PRESENT_SUGGESTIONS,
    description: 'Tối đa 4 gợi ý bước tiếp theo, kết thúc lượt.',
    input_schema: {
      type: 'object' as const,
      properties: { suggestions: { type: 'array', items: { type: 'string' } } },
      required: ['suggestions'],
    },
  })
  return tools
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((v): v is string => typeof v === 'string'))].slice(0, 50)
}

export async function dispatchMerchantTool(
  ctx: MerchantDispatchContext,
  name: string,
  input: Record<string, unknown>,
): Promise<{ text: string; signed?: SignedChange }> {
  try {
    switch (name) {
      case TOOL_SNAPSHOT: {
        return { text: fencePayload({ result: 'ok', snapshot: await businessSnapshot() }) }
      }
      case TOOL_ALERTS: {
        return { text: fencePayload({ result: 'ok', alerts: await inventoryAlerts() }) }
      }
      case TOOL_ORDER_ISSUES: {
        return { text: fencePayload({ result: 'ok', issues: await orderIssues() }) }
      }
      case TOOL_SEARCH_LISTINGS: {
        const hits = await searchListings(String(input.query ?? ''))
        for (const h of hits) ctx.seenListingIds.add(h.product_id)
        if (hits.length === 0) {
          return { text: fencePayload({ result: 'empty', hint: 'Không tìm thấy. Thử từ khóa khác.' }) }
        }
        return { text: fencePayload({ result: 'ok', listings: hits }) }
      }
      case TOOL_GET_LISTING: {
        const detail = await getListing(String(input.product_id ?? ''))
        if (!detail) return { text: fencePayload({ result: 'not_found' }) }
        ctx.seenListingIds.add(detail.product_id)
        return { text: fencePayload({ result: 'ok', listing: detail }) }
      }
      case TOOL_GET_PRICING: {
        const detail = await getListing(String(input.product_id ?? ''))
        if (!detail) return { text: fencePayload({ result: 'not_found' }) }
        ctx.seenListingIds.add(detail.product_id)
        return {
          text: fencePayload({
            result: 'ok',
            pricing: { product_id: detail.product_id, name: detail.name, variants: detail.variants },
          }),
        }
      }
      case TOOL_STAGE_PUBLISH:
      case TOOL_STAGE_PRICE:
      case TOOL_STAGE_STOCK: {
        const ids = asIdList(input.product_ids).filter((id) => ctx.seenListingIds.has(id))
        if (ids.length === 0) {
          return {
            text: fencePayload({
              result: 'held',
              hint: 'Id chưa được đọc trong cuộc trò chuyện (search_listings/get_listing trước), hoặc danh sách rỗng.',
            }),
          }
        }
        const note = typeof input.note === 'string' ? input.note.slice(0, 500) : null
        const staged =
          name === TOOL_STAGE_PUBLISH
            ? await stagePublish(
                input.target === 'draft' ? 'draft' : input.target === 'archive' ? 'archive' : 'publish',
                ids,
                note,
                ctx.actorUserId,
              )
            : name === TOOL_STAGE_PRICE
              ? await stagePrice(
                  ids,
                  input.mode === 'percent_up' || input.mode === 'percent_down' || input.mode === 'set_sale_off'
                    ? input.mode
                    : 'percent_down',
                  typeof input.value === 'number' ? input.value : 0,
                  note,
                  ctx.actorUserId,
                )
              : await stageStock(
                  ids,
                  typeof input.quantity === 'number' ? input.quantity : -1,
                  note,
                  ctx.actorUserId,
                )
        if (!staged.change) {
          const problems = staged.violations ?? [staged.error ?? 'Stage thất bại.']
          return { text: fencePayload({ result: 'held', violations: problems }) }
        }
        ctx.stagedIds.push(staged.change.change.id)
        return {
          text: fencePayload({ result: 'staged', change: staged.change.change }),
          signed: staged.change,
        }
      }
      case TOOL_PENDING: {
        const pending = await listPendingStaged()
        if (pending.length === 0) {
          return { text: fencePayload({ result: 'ok', pending: [] }) }
        }
        return {
          text: fencePayload({
            result: 'ok',
            pending: pending.map((s) => ({
              change_id: s.change.id,
              kind: s.change.kind,
              summary: s.change.summary,
              items: s.change.items,
            })),
          }),
        }
      }
      case TOOL_PRESENT_SUGGESTIONS: {
        const raw = Array.isArray(input.suggestions) ? input.suggestions : []
        ctx.suggestions = raw.filter((s): s is string => typeof s === 'string').slice(0, 4)
        ctx.endTurn = true
        return { text: fencePayload({ result: 'ok' }) }
      }
      default:
        return { text: fencePayload({ result: 'error', hint: `Unknown tool: ${name}` }) }
    }
  } catch (error) {
    return {
      text: fencePayload({
        result: 'error',
        hint: `Tool tạm thời không khả dụng (${error instanceof Error ? error.message : 'unknown'}).`,
      }),
    }
  }
}
