/**
 * Pilot config for the TechStore merchant assistant (TypeScript port of the
 * `commerce-agents` merchant agent, Messages-API path).
 *
 * Full scope: performance reads + inventory/order alerts + listing reads +
 * staged publish/price/stock changes with host approval + campaign briefs +
 * analysis delegate + scheduled digest.
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
  enableCampaigns: true,
  enableAnalysis: true,

  maxItemsPerChange: 10,
  maxPriceDeltaPct: 20,
  maxRestockQuantity: 1000,
}

/** Systems the merchant assistant cannot supply (kept for honesty). */
export function limitations(): string[] {
  return [
    'Duyệt brief chiến dịch không tự tạo coupon/flash sale — người vận hành thực hiện tay theo hướng dẫn trong brief.',
  ]
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
