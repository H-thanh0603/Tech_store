/**
 * JEV tool-filter layer: shrink the tool list the LLM sees each turn.
 *
 * Full schema on every round costs input tokens, invites wrong tool calls
 * and extra rounds. This layer picks only the buckets the turn needs:
 * keyword fast path (free, no network) → history inheritance for gray
 * follow-ups ("cái thứ 2 thì sao" reuses the previous turn's buckets, still
 * no network) → JEV bucket decision → fail-open full toolset on low
 * confidence / error / disabled.
 *
 * JEV only selects tool *groups*. Prices, orders, policies still come
 * from tool results (grounding unchanged). `JEV_TOOL_FILTER=0` restores
 * the full toolset (emergency rollback). Applies to shopping and merchant.
 */

import type Anthropic from '@anthropic-ai/sdk'

import { ORDER_INTENT_TERMS, POLICY_INTENT_TERMS } from './config'
import { isJevEnabled, jevDecide, jevThreshold } from './jev'
import {
  buildAnthropicTools,
  TOOL_ADD_TO_CART,
  TOOL_COMPARE_PRODUCTS,
  TOOL_CREATE_PLAN,
  TOOL_GET_CART,
  TOOL_GET_FULFILLMENT,
  TOOL_GET_PRODUCT_DETAILS,
  TOOL_ORDER_HISTORY,
  TOOL_PRESENT_SUGGESTIONS,
  TOOL_REMOVE_FROM_CART,
  TOOL_SEARCH_POLICIES,
  TOOL_SEARCH_PRODUCTS,
  TOOL_START_CHECKOUT,
  TOOL_TRACK_ORDER,
  TOOL_UPDATE_CART_ITEM,
} from './tools'
import { CHANGE_INTENT_TERMS, METRICS_INTENT_TERMS } from './merchant/config'
import {
  buildMerchantTools,
  TOOL_ALERTS,
  TOOL_DRAFT_CAMPAIGN,
  TOOL_GET_DIGEST,
  TOOL_GET_LISTING,
  TOOL_GET_PRICING,
  TOOL_LIST_CAMPAIGNS,
  TOOL_ORDER_ISSUES,
  TOOL_PENDING,
  TOOL_RUN_ANALYSIS,
  TOOL_SEARCH_LISTINGS,
  TOOL_SNAPSHOT,
  TOOL_STAGE_PRICE,
  TOOL_STAGE_PUBLISH,
  TOOL_STAGE_STOCK,
  TOOL_PRESENT_SUGGESTIONS as MERCHANT_SUGGESTIONS,
} from './merchant/tools'

export type ShoppingToolBucket = 'catalog' | 'cart' | 'order' | 'policy' | 'fulfillment'
export type MerchantToolBucket = 'metrics' | 'inventory' | 'listing' | 'campaign'

/** How many previous user messages a gray follow-up may inherit buckets from. */
const HISTORY_TURNS = 3

const SHOPPING_BUCKET_CHOICES = ['catalog', 'cart', 'order', 'policy', 'fulfillment', 'all'] as const
const MERCHANT_BUCKET_CHOICES = ['metrics', 'inventory', 'listing', 'campaign', 'all'] as const

const SHOPPING_TOOL_BUCKET_MAP: Record<string, ShoppingToolBucket> = {
  [TOOL_SEARCH_PRODUCTS]: 'catalog',
  [TOOL_GET_PRODUCT_DETAILS]: 'catalog',
  [TOOL_COMPARE_PRODUCTS]: 'catalog',
  [TOOL_CREATE_PLAN]: 'catalog',
  [TOOL_GET_CART]: 'cart',
  [TOOL_ADD_TO_CART]: 'cart',
  [TOOL_UPDATE_CART_ITEM]: 'cart',
  [TOOL_REMOVE_FROM_CART]: 'cart',
  [TOOL_START_CHECKOUT]: 'cart',
  [TOOL_TRACK_ORDER]: 'order',
  [TOOL_ORDER_HISTORY]: 'order',
  [TOOL_SEARCH_POLICIES]: 'policy',
  [TOOL_GET_FULFILLMENT]: 'fulfillment',
}

const MERCHANT_TOOL_BUCKET_MAP: Record<string, MerchantToolBucket> = {
  [TOOL_SNAPSHOT]: 'metrics',
  [TOOL_RUN_ANALYSIS]: 'metrics',
  [TOOL_GET_DIGEST]: 'metrics',
  [TOOL_ALERTS]: 'inventory',
  [TOOL_ORDER_ISSUES]: 'inventory',
  [TOOL_SEARCH_LISTINGS]: 'listing',
  [TOOL_GET_LISTING]: 'listing',
  [TOOL_GET_PRICING]: 'listing',
  [TOOL_STAGE_PUBLISH]: 'listing',
  [TOOL_STAGE_PRICE]: 'listing',
  [TOOL_STAGE_STOCK]: 'listing',
  [TOOL_PENDING]: 'listing',
  [TOOL_DRAFT_CAMPAIGN]: 'campaign',
  [TOOL_LIST_CAMPAIGNS]: 'campaign',
}

const CART_TERMS = [
  'giỏ',
  'cart',
  'checkout',
  'chốt đơn',
  'thêm vào giỏ',
  'xóa khỏi giỏ',
  'xoá khỏi giỏ',
  'bỏ khỏi giỏ',
  'xem giỏ',
  'thanh toán',
] as const

const FULFILLMENT_TERMS = [
  'phí ship',
  'giao hàng',
  'vận chuyển',
  'nhận tại',
  'chi nhánh',
  'pickup',
  'mở cửa',
] as const

// Order codes always have a hyphen (TS-ABC123). The shared
// ORDER_CODE_PATTERN allows no hyphen, so plain words like LAPTOP
// match it uppercased — useless for bucket picking.
const TOOL_ORDER_CODE_PATTERN = /\b[A-Z]{2,3}-[A-Z0-9]{4,10}\b/

// Product words only — deliberately no generic 'hàng'/'đơn'/'đặt' so cart
// and order questions don't drag the catalog bucket along.
const CATALOG_TERMS = [
  'laptop',
  'điện thoại',
  'dienthoai',
  'phụ kiện',
  'phu kien',
  'màn hình',
  'tai nghe',
  'loa',
  'đồng hồ',
  'tablet',
  'tư vấn',
  'gợi ý',
  'so sánh',
  'sosánh',
  'compare',
  'review',
  'thông số',
  'cấu hình',
  'chip',
  'ram',
  'pin',
  'sạc',
  'khuyến mãi',
  'sale',
  'giảm giá',
  'coupon',
  'trả góp',
  'còn hàng',
  'hết hàng',
  'tồn kho',
  'ngân sách',
  'triệu',
  'nghìn',
  'rẻ',
  'đắt',
  'chốt',
  'tìm',
  'chọn',
  'mua',
  'giá',
  'máy',
  'bán',
] as const

const MERCHANT_INVENTORY_TERMS = [
  'chờ xử lý',
  'đơn mở',
  'đơn cần xử lý',
  'cảnh báo tồn',
  'pending',
  'awaiting',
  'nhập hàng',
  'restock',
] as const

const MERCHANT_LISTING_TERMS = [
  ...CHANGE_INTENT_TERMS,
  'listing',
  'catalog',
  'sản phẩm',
  'chi tiết sản phẩm',
  'định giá',
] as const

const MERCHANT_CAMPAIGN_TERMS = [
  'campaign',
  'chiến dịch',
  'brief',
  'coupon',
  'flash sale',
  'flash_sale',
] as const

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((t) => text.includes(t))
}

/** Buckets with a clear keyword signal. Empty = ambiguous (gray). */
export function keywordToolBuckets(text: string): ShoppingToolBucket[] {
  const lower = text.toLowerCase()
  const out = new Set<ShoppingToolBucket>()
  if (includesAny(lower, POLICY_INTENT_TERMS)) out.add('policy')
  if (includesAny(lower, ORDER_INTENT_TERMS) || TOOL_ORDER_CODE_PATTERN.test(text.toUpperCase())) {
    out.add('order')
  }
  if (includesAny(lower, CART_TERMS)) out.add('cart')
  if (includesAny(lower, FULFILLMENT_TERMS)) out.add('fulfillment')
  if (includesAny(lower, CATALOG_TERMS)) out.add('catalog')
  return [...out]
}

/** Buckets with a clear keyword signal (merchant). Empty = ambiguous. */
export function keywordMerchantBuckets(text: string): MerchantToolBucket[] {
  const lower = text.toLowerCase()
  const out = new Set<MerchantToolBucket>()
  if (includesAny(lower, METRICS_INTENT_TERMS)) out.add('metrics')
  if (includesAny(lower, MERCHANT_INVENTORY_TERMS)) out.add('inventory')
  if (includesAny(lower, MERCHANT_LISTING_TERMS)) out.add('listing')
  if (includesAny(lower, MERCHANT_CAMPAIGN_TERMS)) out.add('campaign')
  return [...out]
}

export type ToolFilterSource = 'keyword' | 'history' | 'jev' | 'full'

export interface ToolFilterResult {
  tools: Anthropic.Tool[]
  buckets: ShoppingToolBucket[] | ['all']
  source: ToolFilterSource
}

export interface MerchantToolFilterResult {
  tools: Anthropic.Tool[]
  buckets: MerchantToolBucket[] | ['all']
  source: ToolFilterSource
}

/** Compact per-turn measurement: which buckets, from where, how many schemas sent. */
export interface ToolFilterSummary {
  source: ToolFilterSource
  buckets: string[]
  /** Tool schemas actually sent to the model this turn. */
  sent: number
  /** Full toolset size for comparison (sent/full = schema saving). */
  full: number
}

function toSummary(
  result: { tools: Anthropic.Tool[]; buckets: readonly string[]; source: ToolFilterSource },
  full: number,
): ToolFilterSummary {
  return { source: result.source, buckets: [...result.buckets], sent: result.tools.length, full }
}

/** Summary for turns that never reach the model (not configured, guard refusals). */
export function fullShoppingSummary(): ToolFilterSummary {
  const tools = buildAnthropicTools()
  return toSummary({ tools, buckets: ['all'], source: 'full' }, tools.length)
}

/** Summary for merchant turns that never reach the model. */
export function fullMerchantSummary(): ToolFilterSummary {
  const tools = buildMerchantTools()
  return toSummary({ tools, buckets: ['all'], source: 'full' }, tools.length)
}

export function shoppingFilterSummary(result: ToolFilterResult): ToolFilterSummary {
  return toSummary(result, buildAnthropicTools().length)
}

export function merchantFilterSummary(result: MerchantToolFilterResult): ToolFilterSummary {
  return toSummary(result, buildMerchantTools().length)
}

/** Emergency rollback: `JEV_TOOL_FILTER=0` restores the full toolset. */
function isToolFilterEnabled(): boolean {
  return process.env.JEV_TOOL_FILTER !== '0'
}

interface CoreDeps<B extends string> {
  text: string
  prevTexts: string[]
  keywordOf: (t: string) => B[]
  subset: (buckets: B[]) => Anthropic.Tool[] | null
  full: () => Anthropic.Tool[]
  jevQuestion: string
  jevChoices: readonly string[]
  fetchFn?: typeof fetch
}

async function resolveCore<B extends string>(
  deps: CoreDeps<B>,
): Promise<{ tools: Anthropic.Tool[]; bucketNames: B[] | ['all']; source: ToolFilterSource }> {
  if (!isToolFilterEnabled()) return { tools: deps.full(), bucketNames: ['all'], source: 'full' }
  const direct = deps.keywordOf(deps.text)
  if (direct.length > 0) {
    const tools = deps.subset(direct)
    return tools
      ? { tools, bucketNames: direct, source: 'keyword' }
      : { tools: deps.full(), bucketNames: ['all'], source: 'full' }
  }
  // Gray follow-up ("cái thứ 2 thì sao"): inherit the nearest previous
  // turn's buckets instead of spending a JEV call.
  const prev = deps.prevTexts.slice(-HISTORY_TURNS)
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const inherited = deps.keywordOf(prev[i] ?? '')
    if (inherited.length === 0) continue
    const tools = deps.subset(inherited)
    if (tools) return { tools, bucketNames: inherited, source: 'history' }
  }
  if (!isJevEnabled()) return { tools: deps.full(), bucketNames: ['all'], source: 'full' }
  try {
    const decision = await jevDecide({
      question: deps.jevQuestion,
      choices: deps.jevChoices,
      context: [...prev, deps.text].join('\n'),
      fetchFn: deps.fetchFn,
    })
    if (!decision || decision.confidence < jevThreshold() || decision.choice === 'all') {
      return { tools: deps.full(), bucketNames: ['all'], source: 'full' }
    }
    const tools = deps.subset([decision.choice as B])
    return tools
      ? { tools, bucketNames: [decision.choice as B], source: 'jev' }
      : { tools: deps.full(), bucketNames: ['all'], source: 'full' }
  } catch {
    return { tools: deps.full(), bucketNames: ['all'], source: 'full' }
  }
}

function shoppingSubset(buckets: ShoppingToolBucket[]): Anthropic.Tool[] | null {
  const allowed = new Set<string>([TOOL_PRESENT_SUGGESTIONS])
  for (const [name, bucket] of Object.entries(SHOPPING_TOOL_BUCKET_MAP)) {
    if (buckets.includes(bucket)) allowed.add(name)
  }
  const tools = buildAnthropicTools().filter((t) => allowed.has(t.name))
  // Config may disable every tool in the picked buckets — never leave the
  // model with suggestions alone, fall back to full instead.
  return tools.length > 1 ? tools : null
}

function merchantSubset(buckets: MerchantToolBucket[]): Anthropic.Tool[] | null {
  const allowed = new Set<string>([MERCHANT_SUGGESTIONS])
  for (const [name, bucket] of Object.entries(MERCHANT_TOOL_BUCKET_MAP)) {
    if (buckets.includes(bucket)) allowed.add(name)
  }
  const tools = buildMerchantTools().filter((t) => allowed.has(t.name))
  return tools.length > 1 ? tools : null
}

const SHOPPING_BUCKET_QUESTION =
  'Which shopping tool group does this customer message need? ' +
  'catalog=products/price/compare, cart=cart/checkout, order=track/history, ' +
  'policy=store policies, fulfillment=shipping/pickup, all=multiple or unclear.'

const MERCHANT_BUCKET_QUESTION =
  'Which ops tool group does this staff message need? ' +
  'metrics=revenue/snapshot/analysis/digest, inventory=stock alerts/open orders, ' +
  'listing=search/detail/stage price-stock-publish changes, ' +
  'campaign=promo briefs, all=multiple or unclear.'

export interface FilterDeps {
  fetchFn?: typeof fetch
  /** Previous user messages (oldest first); gray follow-ups inherit from these. */
  prevTexts?: string[]
}

/**
 * Resolve the shopping tool list for one turn. Never throws, never returns
 * empty: any doubt → full toolset.
 */
export async function resolveShoppingTools(text: string, deps?: FilterDeps): Promise<ToolFilterResult> {
  const out = await resolveCore<ShoppingToolBucket>({
    text,
    prevTexts: deps?.prevTexts ?? [],
    keywordOf: keywordToolBuckets,
    subset: shoppingSubset,
    full: buildAnthropicTools,
    jevQuestion: SHOPPING_BUCKET_QUESTION,
    jevChoices: SHOPPING_BUCKET_CHOICES,
    fetchFn: deps?.fetchFn,
  })
  return { tools: out.tools, buckets: out.bucketNames, source: out.source }
}

/**
 * Resolve the merchant tool list for one turn. Same contract as shopping:
 * never throws, never empty, any doubt → full toolset.
 */
export async function resolveMerchantTools(text: string, deps?: FilterDeps): Promise<MerchantToolFilterResult> {
  const out = await resolveCore<MerchantToolBucket>({
    text,
    prevTexts: deps?.prevTexts ?? [],
    keywordOf: keywordMerchantBuckets,
    subset: merchantSubset,
    full: buildMerchantTools,
    jevQuestion: MERCHANT_BUCKET_QUESTION,
    jevChoices: MERCHANT_BUCKET_CHOICES,
    fetchFn: deps?.fetchFn,
  })
  return { tools: out.tools, buckets: out.bucketNames, source: out.source }
}
