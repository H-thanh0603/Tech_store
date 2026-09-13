/**
 * Pilot config for the TechStore shopping assistant (TypeScript port of the
 * `commerce-agents` shopping agent, Messages-API path).
 *
 * Scope: catalog search + details + compare + plans + cart (shared guest
 * cart) + order tracking + order history (phone-scoped) + policies.
 * Fulfillment options and rule-based memory are ON — see docs/ASSISTANT.md.
 * Model-driven memory extraction and image input are OFF by default
 * (enable_* switches); their flows park under skills/_staged/.
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
  /** Phone-scoped recent-order lookup (guest-safe: code+phone never minted). */
  enableOrderHistory: boolean
  enablePolicies: boolean
  enableFulfillment: boolean
  /** Post-turn model extraction (1 extra call/turn); OFF = rule-based. */
  enableMemoryExtraction: boolean
  /** Image input blocks; OFF = text-only with an honest notCapability. */
  enableImageInput: boolean
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

  enableCart: true,
  enableOrders: true,
  enableOrderHistory: process.env.ASSISTANT_NO_ORDER_HISTORY !== '1',
  enablePolicies: true,
  enableFulfillment: true,
  // ASSISTANT_MEMORY=model spends 1 extra model call per turn on extraction;
  // anything else keeps the rule-based default (no extra call).
  enableMemoryExtraction: process.env.ASSISTANT_MEMORY === 'model',
  enableImageInput: process.env.ASSISTANT_IMAGE_INPUT === '1',
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
