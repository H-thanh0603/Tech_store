/**
 * Pilot config for the TechStore shopping assistant (TypeScript port of the
 * `commerce-agents` shopping agent, Messages-API path).
 *
 * Pilot scope: catalog search + product details + order tracking + policies.
 * Cart writes, order history, fulfillment and memory extraction are OFF —
 * see `absentTools()` and docs/ASSISTANT.md.
 */

export interface AssistantConfig {
  assistantName: string
  brandName: string
  brandVoice: string
  model: string
  maxTokens: number
  /** Hard ceiling on model<->tool rounds per turn. */
  maxToolIterations: number
  /** Max products returned per search (already clamped in the backend too). */
  searchLimit: number

  enableCart: boolean
  enableOrders: boolean
  enablePolicies: boolean
  enableFulfillment: boolean
}

export const assistantConfig: AssistantConfig = {
  assistantName: 'Trợ lý TechStore',
  brandName: 'TechStore',
  brandVoice: 'thân thiện, ngắn gọn, nói rõ đánh đổi',
  // Overridable via ASSISTANT_MODEL. Provider default comes from
  // defaultModelFor() so it tracks ASSISTANT_PROVIDER at import time.
  model:
    process.env.ASSISTANT_MODEL ??
    (process.env.ASSISTANT_PROVIDER === 'deepseek' ? 'deepseek-chat' : 'claude-haiku-4-5'),
  maxTokens: 1024,
  maxToolIterations: 5,
  searchLimit: 6,

  enableCart: false,
  enableOrders: true,
  enablePolicies: true,
  enableFulfillment: false,
}

/** Tool names the pilot leaves out for systems switched off above. */
export function absentTools(config: AssistantConfig): ReadonlySet<string> {
  const names = new Set<string>()
  if (!config.enableCart) {
    for (const t of ['get_cart', 'add_to_cart', 'update_cart_item', 'remove_from_cart', 'checkout']) {
      names.add(t)
    }
  }
  if (!config.enableOrders) {
    for (const t of ['get_orders', 'track_order']) names.add(t)
  }
  if (!config.enablePolicies) names.add('search_policies')
  if (!config.enableFulfillment) names.add('get_fulfillment_options')
  return names
}

/** Vietnamese intent lexicon for the policy grounding gate. */
export const POLICY_INTENT_TERMS = [
  'đổi trả',
  'trả hàng',
  'hoàn tiền',
  'bảo hành',
  'bảo trì',
  'chính sách',
  'điều khoản',
  'điều kiện',
  'vận chuyển',
  'giao hàng',
  'phí ship',
  'thanh toán',
  'cod',
  'vnpay',
  'khiếu nại',
] as const

/** Vietnamese intent lexicon for the order grounding gate. */
export const ORDER_INTENT_TERMS = [
  'đơn hàng',
  'mã đơn',
  'tra cứu',
  'theo dõi đơn',
  'kiểm tra đơn',
  'giao tới đâu',
  'hàng tới chưa',
  'đơn của tôi',
] as const

/** Order-code pattern (e.g. TS-XXXXXX): grounds through track_order. */
export const ORDER_CODE_PATTERN = /\b[A-Z]{2,3}-?[A-Z0-9]{4,10}\b/

export function wantsPolicyGrounding(message: string): boolean {
  const lower = message.toLowerCase()
  return POLICY_INTENT_TERMS.some((term) => lower.includes(term))
}

export function wantsOrderGrounding(message: string): boolean {
  const lower = message.toLowerCase()
  return ORDER_CODE_PATTERN.test(message) || ORDER_INTENT_TERMS.some((term) => lower.includes(term))
}
