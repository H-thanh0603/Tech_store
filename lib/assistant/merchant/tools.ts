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
import { ANALYSIS_TEMPLATES, runAnalysis } from './analysis'
import { draftCampaignBrief, listCampaignBriefs } from './campaigns'
import { latestDigest } from './digest'
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
export const TOOL_DRAFT_CAMPAIGN = 'draft_campaign_brief'
export const TOOL_LIST_CAMPAIGNS = 'list_campaign_briefs'
export const TOOL_RUN_ANALYSIS = 'run_analysis'
export const TOOL_GET_DIGEST = 'get_latest_digest'
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
  if (cfg.enableCampaigns) {
    tools.push(
      {
        name: TOOL_DRAFT_CAMPAIGN,
        description:
          'Soạn brief chiến dịch khuyến mãi (tư vấn, không tự áp dụng). Brief chờ người duyệt ở trang chiến dịch rồi thực hiện tay qua coupon/flash sale.',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string', description: 'Tên chiến dịch 4–120 ký tự' },
            mechanic: { type: 'string', enum: ['percent_off', 'fixed_off', 'bundle', 'free_shipping', 'flash_sale'] },
            discount_pct: { type: 'number', description: 'Phần trăm giảm, tối đa 50' },
            starts_at: { type: 'string', description: 'Ngày bắt đầu YYYY-MM-DD' },
            ends_at: { type: 'string', description: 'Ngày kết thúc YYYY-MM-DD' },
            rationale: { type: 'string', description: 'Vì sao chạy chiến dịch này' },
            execution: { type: 'string', description: 'Hướng dẫn thực hiện tay (tạo coupon/flash nào)' },
          },
          required: ['title', 'mechanic', 'execution'],
        },
      },
      {
        name: TOOL_LIST_CAMPAIGNS,
        description: 'Liệt kê brief chiến dịch đang chờ duyệt.',
        input_schema: { type: 'object' as const, properties: {} },
      },
    )
  }
  if (cfg.enableAnalysis) {
    tools.push(
      {
        name: TOOL_RUN_ANALYSIS,
        description:
          'Chạy phân tích theo mẫu có sẵn trên số liệu live (không SQL tự do): snapshot, low_stock, open_orders, revenue_by_payment, category_mix.',
        input_schema: {
          type: 'object' as const,
          properties: {
            template: { type: 'string', enum: ['snapshot', 'low_stock', 'open_orders', 'revenue_by_payment', 'category_mix'] },
            limit: { type: 'number', description: 'Số dòng tối đa 1–50' },
          },
          required: ['template'],
        },
      },
      {
        name: TOOL_GET_DIGEST,
        description: 'Đọc bản tin vận hành gần nhất (cron tổng hợp mỗi sáng).',
        input_schema: { type: 'object' as const, properties: {} },
      },
    )
  }
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
        const query = typeof input.query === 'string' ? input.query.trim().slice(0, 120) : ''
        if (!query) {
          return { text: fencePayload({ result: 'invalid_args', hint: 'query là chuỗi bắt buộc (1–120 ký tự).' }) }
        }
        const hits = await searchListings(query)
        for (const h of hits) ctx.seenListingIds.add(h.product_id)
        if (hits.length === 0) {
          return { text: fencePayload({ result: 'empty', hint: 'Không tìm thấy. Thử từ khóa khác.' }) }
        }
        return { text: fencePayload({ result: 'ok', listings: hits }) }
      }
      case TOOL_GET_LISTING: {
        const productId = typeof input.product_id === 'string' ? input.product_id.trim().slice(0, 160) : ''
        if (!productId) {
          return { text: fencePayload({ result: 'invalid_args', hint: 'product_id là chuỗi bắt buộc.' }) }
        }
        const detail = await getListing(productId)
        if (!detail) return { text: fencePayload({ result: 'not_found' }) }
        ctx.seenListingIds.add(detail.product_id)
        return { text: fencePayload({ result: 'ok', listing: detail }) }
      }
      case TOOL_GET_PRICING: {
        const pricingId = typeof input.product_id === 'string' ? input.product_id.trim().slice(0, 160) : ''
        if (!pricingId) {
          return { text: fencePayload({ result: 'invalid_args', hint: 'product_id là chuỗi bắt buộc.' }) }
        }
        const detail = await getListing(pricingId)
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
        // Strict params: no silent defaults — a missing/invalid mode, value or
        // quantity is held with a fix hint instead of guessing the merchant's intent.
        const priceMode =
          input.mode === 'percent_up' || input.mode === 'percent_down' || input.mode === 'set_sale_off'
            ? input.mode
            : null
        const priceValue = typeof input.value === 'number' && Number.isFinite(input.value) ? input.value : null
        const stockQty =
          typeof input.quantity === 'number' && Number.isInteger(input.quantity) && input.quantity >= 0
            ? input.quantity
            : null
        if (name === TOOL_STAGE_PRICE && (priceMode === null || priceValue === null)) {
          return {
            text: fencePayload({
              result: 'invalid_args',
              hint: 'mode phải một trong percent_up/percent_down/set_sale_off và value phải là số.',
            }),
          }
        }
        if (name === TOOL_STAGE_STOCK && stockQty === null) {
          return {
            text: fencePayload({ result: 'invalid_args', hint: 'quantity phải là số nguyên ≥ 0.' }),
          }
        }
        const staged =
          name === TOOL_STAGE_PUBLISH
            ? await stagePublish(
                input.target === 'draft' ? 'draft' : input.target === 'archive' ? 'archive' : 'publish',
                ids,
                note,
                ctx.actorUserId,
              )
            : name === TOOL_STAGE_PRICE
              ? await stagePrice(ids, priceMode ?? 'percent_down', priceValue ?? 0, note, ctx.actorUserId)
              : await stageStock(ids, stockQty ?? -1, note, ctx.actorUserId)
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
      case TOOL_DRAFT_CAMPAIGN: {
        const { brief, error } = await draftCampaignBrief(
          {
            title: String(input.title ?? ''),
            mechanic: String(input.mechanic ?? ''),
            discount_pct: typeof input.discount_pct === 'number' ? input.discount_pct : undefined,
            starts_at: typeof input.starts_at === 'string' ? input.starts_at : undefined,
            ends_at: typeof input.ends_at === 'string' ? input.ends_at : undefined,
            rationale: typeof input.rationale === 'string' ? input.rationale : undefined,
            execution: String(input.execution ?? ''),
          },
          ctx.actorUserId,
        )
        if (!brief) return { text: fencePayload({ result: 'held', hint: error ?? 'Brief không hợp lệ.' }) }
        return { text: fencePayload({ result: 'staged', brief }) }
      }
      case TOOL_LIST_CAMPAIGNS: {
        return { text: fencePayload({ result: 'ok', briefs: await listCampaignBriefs() }) }
      }
      case TOOL_RUN_ANALYSIS: {
        if (!ANALYSIS_TEMPLATES.includes(String(input.template ?? '') as (typeof ANALYSIS_TEMPLATES)[number])) {
          return {
            text: fencePayload({ result: 'held', hint: `template phải một trong: ${ANALYSIS_TEMPLATES.join(', ')}.` }),
          }
        }
        const limit =
          typeof input.limit === 'number' && Number.isInteger(input.limit)
            ? Math.min(Math.max(input.limit, 1), 50)
            : 10
        const { result, error } = await runAnalysis(String(input.template), limit)
        if (!result) return { text: fencePayload({ result: 'error', hint: error ?? 'Phân tích thất bại.' }) }
        return { text: fencePayload({ result: 'ok', analysis: result }) }
      }
      case TOOL_GET_DIGEST: {
        const digest = await latestDigest()
        if (!digest) {
          return { text: fencePayload({ result: 'empty', hint: 'Chưa có bản tin nào — cron digest chạy mỗi sáng.' }) }
        }
        return { text: fencePayload({ result: 'ok', digest }) }
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
