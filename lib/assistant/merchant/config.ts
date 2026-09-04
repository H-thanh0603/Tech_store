/**
 * Pilot config for the TechStore merchant assistant (TypeScript port of the
 * `commerce-agents` merchant agent, Messages-API path).
 *
 * Pilot scope: performance reads + inventory/order alerts + listing reads +
 * staged publish/price/stock changes with host approval. Campaigns and the
 * SQL analysis delegate are OFF — see limitations() and docs/ASSISTANT.md.
 */

export interface MerchantPilotConfig {
  assistantName: string
  brandName: string
  brandVoice: string
  model: string
  maxTokens: number
  maxToolIterations: number

  enableListingReads: boolean
  enableInventory: boolean
  enablePricing: boolean
  enableCampaigns: boolean
  enableAnalysis: boolean

  // Guardrails, checked at stage time and again before apply.
  maxItemsPerChange: number
  maxPriceDeltaPct: number
  maxRestockQuantity: number
}

export const merchantConfig: MerchantPilotConfig = {
  assistantName: 'Trợ lý vận hành',
  brandName: 'TechStore',
  brandVoice: 'rõ ràng, số liệu trước, đề xuất hành động nhỏ nhất',
  model:
    process.env.ASSISTANT_MODEL ??
    (process.env.ASSISTANT_PROVIDER === 'deepseek' ? 'deepseek-chat' : 'claude-haiku-4-5'),
  maxTokens: 1024,
  maxToolIterations: 5,

  enableListingReads: true,
  enableInventory: true,
  enablePricing: true,
  enableCampaigns: false,
  enableAnalysis: false,

  maxItemsPerChange: 10,
  maxPriceDeltaPct: 20,
  maxRestockQuantity: 1000,
}

/** Systems the pilot cannot supply (merchant-context limitations). */
export function limitations(): string[] {
  const out: string[] = []
  if (!merchantConfig.enableCampaigns) {
    out.push('Chiến dịch marketing: TechStore chưa có hệ thống campaign — trợ lý chỉ tư vấn bằng lời, không stage thay đổi.')
  }
  if (!merchantConfig.enableAnalysis) {
    out.push('Phân tích SQL tự do: chưa hỗ trợ — số liệu lấy từ snapshot và báo cáo có sẵn.')
  }
  return out
}

/** Vietnamese intent lexicon for the metrics grounding gate. */
export const METRICS_INTENT_TERMS = [
  'doanh thu',
  'doanh số',
  'đơn hàng',
  'tình hình',
  'hiệu quả',
  'bán chạy',
  'bán chậm',
  'tồn kho',
  'hết hàng',
  'sắp hết',
  'báo cáo',
  'thống kê',
  'tuần này',
  'tháng này',
  'hôm nay',
  'hôm qua',
] as const

/** Vietnamese intent lexicon for the change (staging) follow-through hint. */
export const CHANGE_INTENT_TERMS = [
  'giảm giá',
  'tăng giá',
  'khuyến mãi',
  'sale',
  'nhập hàng',
  'restock',
  'xuất bản',
  'publish',
  'ẩn',
  'lưu trữ',
  'archive',
  'đăng bán',
  'ngừng bán',
] as const

export function wantsMetricsGrounding(message: string): boolean {
  const lower = message.toLowerCase()
  return METRICS_INTENT_TERMS.some((term) => lower.includes(term))
}

export function wantsChangeHint(message: string): boolean {
  const lower = message.toLowerCase()
  return CHANGE_INTENT_TERMS.some((term) => lower.includes(term))
}
