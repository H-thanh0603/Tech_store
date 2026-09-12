/**
 * Tool contracts (port of `commerce-agents` tools/registry, pilot subset).
 * The model only ever calls these; every handler runs server-side and its
 * result is fenced before re-entering the conversation.
 */

import type Anthropic from '@anthropic-ai/sdk'

import {
  buildShoppingPlan,
  compareProducts,
  fulfillmentOptions,
  getProductDetails,
  policyResults,
  searchProducts,
  trackOrder,
  type CardSummary,
  type OrderStatusSummary,
  type ProductDetailSummary,
} from './backend'
import { absentTools, assistantConfig } from './config'
import { fencePayload } from './fencing'
import {
  chatAddToCart,
  chatCheckoutHandoff,
  chatRemoveFromCart,
  chatUpdateCartItem,
  getChatCart,
  type CartRpcClient,
} from './cart'

export const TOOL_SEARCH_PRODUCTS = 'search_products'
export const TOOL_GET_PRODUCT_DETAILS = 'get_product_details'
export const TOOL_COMPARE_PRODUCTS = 'compare_products'
export const TOOL_CREATE_PLAN = 'create_shopping_plan'
export const TOOL_GET_FULFILLMENT = 'get_fulfillment_options'
export const TOOL_GET_CART = 'get_cart'
export const TOOL_ADD_TO_CART = 'add_to_cart'
export const TOOL_UPDATE_CART_ITEM = 'update_cart_item'
export const TOOL_REMOVE_FROM_CART = 'remove_from_cart'
export const TOOL_START_CHECKOUT = 'start_checkout'
export const TOOL_TRACK_ORDER = 'track_order'
export const TOOL_SEARCH_POLICIES = 'search_policies'
export const TOOL_PRESENT_SUGGESTIONS = 'present_suggestions'

export interface DispatchContext {
  /** product/variant ids returned this turn (for card rendering + id→slug). */
  seenIds: Map<string, string>
  /** Product cards to render under the reply. */
  cards: CardSummary[]
  /** Chips recorded via present_suggestions (ends the turn). */
  suggestions: string[]
  endTurn: boolean
  /** SHA-256 of the guest cart token (chat shares the storefront cart). */
  cartTokenHash: string | null
  /** Injectable cart RPC client (tests). */
  cartRpc?: CartRpcClient
}

export function createDispatchContext(init?: { cartTokenHash?: string | null; cartRpc?: CartRpcClient }): DispatchContext {
  return {
    seenIds: new Map(),
    cards: [],
    suggestions: [],
    endTurn: false,
    cartTokenHash: init?.cartTokenHash ?? null,
    cartRpc: init?.cartRpc,
  }
}

export function buildAnthropicTools(): Anthropic.Tool[] {
  const absent = absentTools(assistantConfig)
  const tools: Anthropic.Tool[] = []
  if (!absent.has(TOOL_SEARCH_PRODUCTS)) {
    tools.push({
      name: TOOL_SEARCH_PRODUCTS,
      description:
        'Tìm sản phẩm trong catalog TechStore theo tên/nhu cầu. Luôn gọi trước khi mô tả sản phẩm đang bán. Trả về tối đa 6 sản phẩm kèm giá VND, tồn kho, ảnh và link.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Từ khóa tiếng Việt, ví dụ "laptop học tập dưới 20 triệu"' },
          category: { type: 'string', description: 'Slug danh mục: laptop, dien-thoai, phu-kien, pc, man-hinh, am-thanh, dong-ho, hang-cu' },
          brand: { type: 'string', description: 'Slug thương hiệu: apple, dell, samsung, asus, sony, jbl, xiaomi' },
          max_price: { type: 'number', description: 'Giá trần VND khi khách nêu ngân sách' },
        },
        required: ['query'],
      },
    })
  }
  if (!absent.has(TOOL_GET_PRODUCT_DETAILS)) {
    tools.push({
      name: TOOL_GET_PRODUCT_DETAILS,
      description:
        'Xem chi tiết một sản phẩm: biến thể (SKU, giá, tồn kho), thông số, ảnh. identifier là slug hoặc product_id do search_products trả về.',
      input_schema: {
        type: 'object' as const,
        properties: {
          identifier: { type: 'string', description: 'Slug sản phẩm hoặc product_id' },
        },
        required: ['identifier'],
      },
    })
  }
  tools.push({
    name: TOOL_COMPARE_PRODUCTS,
    description:
      'So sánh 2–4 sản phẩm cạnh nhau: giá, khuyến mãi, tồn kho, thông số chính. identifier là slug hoặc product_id do search/detail trả về trong cuộc trò chuyện.',
    input_schema: {
      type: 'object' as const,
      properties: {
        identifiers: { type: 'array', items: { type: 'string' }, description: '2–4 slug hoặc product_id' },
      },
      required: ['identifiers'],
    },
  })
  tools.push({
    name: TOOL_CREATE_PLAN,
    description:
      'Chốt kế hoạch mua sắm: kiểm tra tồn kho, giới hạn số lượng và tính tổng tiền so với ngân sách. Dùng khi khách chốt nhiều món hoặc nêu ngân sách tổng.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Tên gợi nhớ, ví dụ "Setup học tập"' },
        budget: { type: 'number', description: 'Ngân sách tổng VND (tùy chọn)' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              identifier: { type: 'string', description: 'Slug hoặc product_id đã thấy trong cuộc trò chuyện' },
              quantity: { type: 'number', description: 'Số lượng 1–10' },
            },
            required: ['identifier', 'quantity'],
          },
        },
      },
      required: ['lines'],
    },
  })
  if (!absent.has(TOOL_GET_CART)) {
    tools.push(
      {
        name: TOOL_GET_CART,
        description: 'Xem giỏ hàng hiện tại của khách (món, số lượng, tạm tính). Gọi trước khi chốt đơn.',
        input_schema: { type: 'object' as const, properties: {} },
      },
      {
        name: TOOL_ADD_TO_CART,
        description:
          'Thêm một biến thể vào giỏ. identifier là variant_id do get_product_details trả về, hoặc slug khi sản phẩm chỉ có đúng một biến thể. quantity 1–10 và trong tồn kho.',
        input_schema: {
          type: 'object' as const,
          properties: {
            identifier: { type: 'string' },
            quantity: { type: 'number', description: 'Số lượng 1–10' },
          },
          required: ['identifier', 'quantity'],
        },
      },
      {
        name: TOOL_UPDATE_CART_ITEM,
        description: 'Đổi số lượng một món trong giỏ (1–10, trong tồn kho).',
        input_schema: {
          type: 'object' as const,
          properties: {
            identifier: { type: 'string' },
            quantity: { type: 'number' },
          },
          required: ['identifier', 'quantity'],
        },
      },
      {
        name: TOOL_REMOVE_FROM_CART,
        description: 'Bỏ một món khỏi giỏ.',
        input_schema: {
          type: 'object' as const,
          properties: { identifier: { type: 'string' } },
          required: ['identifier'],
        },
      },
      {
        name: TOOL_START_CHECKOUT,
        description:
          'Chốt đơn: trả link /checkout + tóm tắt giỏ để khách tự thanh toán trên website. Chỉ gọi khi khách đã xác nhận rõ (confirmed=true). Không đặt hàng hộ, không thu tiền.',
        input_schema: {
          type: 'object' as const,
          properties: { confirmed: { type: 'boolean', description: 'Khách đã nói rõ đồng ý thanh toán' } },
          required: ['confirmed'],
        },
      },
    )
  }
  if (!absent.has(TOOL_GET_FULFILLMENT)) {
    tools.push({
      name: TOOL_GET_FULFILLMENT,
      description:
        'Xem phương thức nhận hàng: phí giao hàng hiện hành (báo giá theo tạm tính/số món khi có), danh sách cửa hàng nhận trực tiếp. Gọi khi khách hỏi ship, giao hàng, nhận tại shop.',
      input_schema: {
        type: 'object' as const,
        properties: {
          subtotal: { type: 'number', description: 'Tạm tính giỏ VND (tùy chọn)' },
          item_count: { type: 'number', description: 'Số món trong giỏ (tùy chọn)' },
        },
      },
    })
  }
  if (!absent.has(TOOL_TRACK_ORDER)) {
    tools.push({
      name: TOOL_TRACK_ORDER,
      description:
        'Tra cứu trạng thái đơn hàng bằng mã đơn + số điện thoại đặt hàng. Chỉ gọi khi có đủ cả hai; không bao giờ đoán số điện thoại.',
      input_schema: {
        type: 'object' as const,
        properties: {
          order_code: { type: 'string', description: 'Mã đơn, ví dụ TS-ABC123' },
          phone: { type: 'string', description: 'Số điện thoại dùng khi đặt hàng' },
        },
        required: ['order_code', 'phone'],
      },
    })
  }
  if (!absent.has(TOOL_SEARCH_POLICIES)) {
    tools.push({
      name: TOOL_SEARCH_POLICIES,
      description:
        'Tra cứu chính sách cửa hàng (đổi trả, hoàn tiền, bảo hành, giao hàng, thanh toán). Mọi phát biểu về điều khoản phải dựa trên kết quả của tool này trong cuộc trò chuyện.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Câu hỏi về chính sách' },
        },
        required: ['query'],
      },
    })
  }
  tools.push({
    name: TOOL_PRESENT_SUGGESTIONS,
    description:
      'Gợi ý tối đa 4 bước tiếp theo dạng chip ngắn (động từ + ngắn gọn, ví dụ "Xem iPhone 15", "Tra cứu đơn hàng"). Gọi cùng lượt với nội dung cuối và kết thúc lượt.',
    input_schema: {
      type: 'object' as const,
      properties: {
        suggestions: { type: 'array', items: { type: 'string' }, description: 'Tối đa 4 gợi ý' },
      },
      required: ['suggestions'],
    },
  })
  return tools
}

function rememberProduct(ctx: DispatchContext, product: CardSummary) {
  ctx.seenIds.set(product.product_id, product.slug)
  if (!ctx.cards.some((c) => c.product_id === product.product_id)) {
    ctx.cards.push(product)
  }
}

function rememberDetail(ctx: DispatchContext, detail: ProductDetailSummary) {
  if (!ctx.cards.some((c) => c.product_id === detail.product_id)) {
    ctx.cards.push({
      product_id: detail.product_id,
      slug: detail.slug,
      name: detail.name,
      brand: detail.brand,
      category: detail.category,
      price: detail.min_price,
      has_discount: detail.has_discount,
      in_stock: detail.in_stock,
      available_stock: detail.available_stock,
      image: detail.images[0] ?? null,
      url: detail.url,
    })
  }
  ctx.seenIds.set(detail.product_id, detail.slug)
  for (const v of detail.variants) ctx.seenIds.set(v.product_id, detail.slug)
}

/** Execute one tool call. Never throws: failures become fenced error text. */
export async function dispatchTool(
  ctx: DispatchContext,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case TOOL_SEARCH_PRODUCTS: {
        const query = String(input.query ?? '')
        const filters = {
          category: typeof input.category === 'string' ? input.category : undefined,
          brand: typeof input.brand === 'string' ? input.brand : undefined,
          maxPrice: typeof input.max_price === 'number' ? input.max_price : undefined,
        }
        const { products, total } = await searchProducts(query, filters)
        for (const p of products) rememberProduct(ctx, p)
        if (products.length === 0) {
          return fencePayload({ result: 'empty', hint: 'Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa rộng hơn.' })
        }
        return fencePayload({ result: 'ok', total, products })
      }
      case TOOL_GET_PRODUCT_DETAILS: {
        const detail = await getProductDetails(String(input.identifier ?? ''), ctx.seenIds)
        if (!detail) {
          return fencePayload({ result: 'not_found', hint: 'Không tìm thấy sản phẩm. Hãy search_products trước.' })
        }
        rememberDetail(ctx, detail)
        return fencePayload({ result: 'ok', product: detail })
      }
      case TOOL_COMPARE_PRODUCTS: {
        const raw = Array.isArray(input.identifiers) ? input.identifiers : []
        const identifiers = raw.filter((s): s is string => typeof s === 'string').slice(0, 4)
        if (identifiers.length < 2) {
          return fencePayload({ result: 'error', hint: 'So sánh cần 2–4 sản phẩm (slug hoặc id đã thấy).' })
        }
        const compared = await compareProducts(identifiers, ctx.seenIds)
        for (const row of compared.rows) {
          rememberProduct(ctx, {
            product_id: row.product_id,
            slug: row.slug,
            name: row.name,
            brand: row.brand,
            category: '',
            price: row.min_price,
            has_discount: row.has_discount,
            in_stock: row.in_stock,
            available_stock: row.available_stock,
            image: null,
            url: row.url,
          })
        }
        return fencePayload({ result: 'ok', ...compared })
      }
      case TOOL_CREATE_PLAN: {
        const rawLines = Array.isArray(input.lines) ? input.lines : []
        const plan = await buildShoppingPlan(
          {
            title: typeof input.title === 'string' ? input.title : undefined,
            budget: typeof input.budget === 'number' ? input.budget : undefined,
            lines: rawLines.map((l) => ({
              identifier: String((l as Record<string, unknown>)?.identifier ?? ''),
              quantity: Number((l as Record<string, unknown>)?.quantity ?? 0),
            })),
          },
          ctx.seenIds,
        )
        return fencePayload({ result: 'ok', plan })
      }
      case TOOL_GET_CART: {
        if (!ctx.cartTokenHash) {
          return fencePayload({ result: 'ok', cart: { item_count: 0, subtotal: 0, items: [] } })
        }
        return fencePayload({ result: 'ok', cart: await getChatCart(ctx.cartTokenHash, ctx.cartRpc) })
      }
      case TOOL_ADD_TO_CART: {
        if (!ctx.cartTokenHash) {
          return fencePayload({ result: 'error', hint: 'Giỏ hàng chưa sẵn sàng trong cuộc trò chuyện này.' })
        }
        const result = await chatAddToCart(
          ctx.cartTokenHash,
          String(input.identifier ?? ''),
          Number(input.quantity ?? 0),
          ctx.seenIds,
          ctx.cartRpc,
        )
        if (!result.ok) return fencePayload({ result: 'error', hint: result.message })
        return fencePayload({ result: 'ok', cart: result.cart })
      }
      case TOOL_UPDATE_CART_ITEM: {
        if (!ctx.cartTokenHash) {
          return fencePayload({ result: 'error', hint: 'Giỏ hàng chưa sẵn sàng trong cuộc trò chuyện này.' })
        }
        const result = await chatUpdateCartItem(
          ctx.cartTokenHash,
          String(input.identifier ?? ''),
          Number(input.quantity ?? 0),
          ctx.seenIds,
          ctx.cartRpc,
        )
        if (!result.ok) return fencePayload({ result: 'error', hint: result.message })
        return fencePayload({ result: 'ok', cart: result.cart })
      }
      case TOOL_REMOVE_FROM_CART: {
        if (!ctx.cartTokenHash) {
          return fencePayload({ result: 'error', hint: 'Giỏ hàng chưa sẵn sàng trong cuộc trò chuyện này.' })
        }
        const result = await chatRemoveFromCart(
          ctx.cartTokenHash,
          String(input.identifier ?? ''),
          ctx.seenIds,
          ctx.cartRpc,
        )
        if (!result.ok) return fencePayload({ result: 'error', hint: result.message })
        return fencePayload({ result: 'ok', cart: result.cart })
      }
      case TOOL_START_CHECKOUT: {
        if (!ctx.cartTokenHash) {
          return fencePayload({ result: 'error', hint: 'Giỏ hàng đang trống.' })
        }
        const { handoff, error } = await chatCheckoutHandoff(
          ctx.cartTokenHash,
          input.confirmed === true,
          ctx.cartRpc,
        )
        if (!handoff) return fencePayload({ result: 'error', hint: error ?? 'Chưa thể chốt đơn.' })
        return fencePayload({ result: 'ok', ...handoff })
      }
      case TOOL_GET_FULFILLMENT: {
        const options = await fulfillmentOptions({
          subtotal: typeof input.subtotal === 'number' ? input.subtotal : undefined,
          itemCount: typeof input.item_count === 'number' ? input.item_count : undefined,
        })
        return fencePayload({ result: 'ok', fulfillment: options })
      }
      case TOOL_TRACK_ORDER: {
        const summary: OrderStatusSummary | null = await trackOrder(
          String(input.order_code ?? ''),
          String(input.phone ?? ''),
        )
        if (!summary) {
          return fencePayload({
            result: 'not_found',
            hint: 'Không tìm thấy đơn với mã + SĐT này. Kiểm tra lại hoặc hướng dẫn khách vào /track-order.',
          })
        }
        return fencePayload({ result: 'ok', order: summary })
      }
      case TOOL_SEARCH_POLICIES: {
        const passages = policyResults(String(input.query ?? ''))
        if (passages.length === 0) {
          return fencePayload({ result: 'empty', hint: 'Không có chính sách liên quan.' })
        }
        return fencePayload({ result: 'ok', policies: passages })
      }
      case TOOL_PRESENT_SUGGESTIONS: {
        const raw = Array.isArray(input.suggestions) ? input.suggestions : []
        ctx.suggestions = raw.filter((s): s is string => typeof s === 'string').slice(0, 4)
        ctx.endTurn = true
        return fencePayload({ result: 'ok' })
      }
      default:
        return fencePayload({ result: 'error', hint: `Unknown tool: ${name}` })
    }
  } catch (error) {
    return fencePayload({
      result: 'error',
      hint: `Tool tạm thời không khả dụng (${error instanceof Error ? error.message : 'unknown'}).`,
    })
  }
}
