/**
 * Agent activity normalization (điểm 6 — Real-time Agent Activity UI +
 * điểm 5 — AI Activity Log). Một AgentCall là một lần model gọi tool trong
 * lượt chat: UI hiển thị trực tiếp, audit log ghi nguyên gói (đã redact).
 *
 * Nhãn là mô tả đọc được (tiếng Việt), KHÔNG phải nguyên tắc bảo mật —
 * tool thật vẫn chạy ở tools.ts; đây chỉ là lớp hiển thị + log.
 */

export interface AgentCall {
  /** Tên tool (contract thật, ví dụ `search_products`). */
  tool: string
  /** Mô tả bước ngắn, tiếng Việt, an toàn để hiển thị cho khách. */
  label: string
  /** Chi tiết 1 dòng (query/trạng thái/đếm) — đã redact PII, cap ký tự. */
  detail?: string
  /** Nhóm bước cho UI gom nhóm. */
  kind: 'lookup' | 'cart' | 'order' | 'suggestion' | 'ops'
}

export type AgentCallObserver = (call: AgentCall) => void

/** Chi tiết tối đa lưu/hiển thị; phần thừa cắt để log không phình. */
const MAX_DETAIL_CHARS = 140

const KIND_BY_TOOL: Record<string, AgentCall['kind']> = {
  search_products: 'lookup',
  get_product_details: 'lookup',
  compare_products: 'lookup',
  create_shopping_plan: 'lookup',
  get_fulfillment_options: 'order',
  search_policies: 'lookup',
  get_cart: 'cart',
  add_to_cart: 'cart',
  update_cart_item: 'cart',
  remove_from_cart: 'cart',
  start_checkout: 'order',
  get_orders: 'order',
  track_order: 'order',
  get_order_history: 'order',
  present_suggestions: 'suggestion',
  get_business_snapshot: 'ops',
  get_inventory_alerts: 'ops',
  get_order_issues: 'ops',
  search_listings: 'ops',
  get_listing: 'ops',
  get_pricing_context: 'ops',
  stage_publish_change: 'ops',
  stage_price_change: 'ops',
  stage_stock_change: 'ops',
  get_pending_changes: 'ops',
  draft_campaign_brief: 'ops',
  list_campaign_briefs: 'ops',
  run_analysis: 'ops',
  get_latest_digest: 'ops',
}

const LABELS: Record<string, string> = {
  search_products: 'Tìm sản phẩm trong catalog',
  get_product_details: 'Xem chi tiết sản phẩm',
  compare_products: 'So sánh sản phẩm',
  create_shopping_plan: 'Lập phương án mua theo ngân sách',
  get_fulfillment_options: 'Tra phí giao hàng & nhận tại cửa hàng',
  search_policies: 'Đọc chính sách cửa hàng',
  get_cart: 'Xem giỏ hàng',
  add_to_cart: 'Thêm vào giỏ hàng',
  update_cart_item: 'Cập nhật giỏ hàng',
  remove_from_cart: 'Xóa khỏi giỏ hàng',
  start_checkout: 'Tạo link thanh toán',
  get_orders: 'Tra cứu đơn hàng',
  track_order: 'Theo dõi tiến trình đơn',
  get_order_history: 'Xem lịch sử đơn hàng',
  present_suggestions: 'Chuẩn bị gợi ý tiếp theo',
  get_business_snapshot: 'Tổng quan doanh thu 7 ngày',
  get_inventory_alerts: 'Kiểm tra cảnh báo tồn kho',
  get_order_issues: 'Rà đơn có vấn đề',
  search_listings: 'Tìm sản phẩm trong admin',
  get_listing: 'Xem chi tiết sản phẩm (admin)',
  get_pricing_context: 'Xem bối cảnh giá',
  stage_publish_change: 'Soạn thay đổi xuất bản',
  stage_price_change: 'Soạn thay đổi giá',
  stage_stock_change: 'Soạn thay đổi tồn kho',
  get_pending_changes: 'Kiểm tra change chờ duyệt',
  draft_campaign_brief: 'Dựng brief chiến dịch',
  list_campaign_briefs: 'Xem các brief đã có',
  run_analysis: 'Chạy phân tích dữ liệu',
  get_latest_digest: 'Đọc bản tin sáng nay',
}

/** Gom các tool gọi lặp thành headline tổng quát cho UI. */
export function activityHeadline(calls: AgentCall[]): string {
  if (calls.length === 0) return 'Đang xử lý yêu cầu'
  const tools = new Set(calls.map((c) => c.tool))
  if (tools.has('compare_products')) return 'Đang so sánh các sản phẩm'
  if (tools.has('add_to_cart')) return 'Đang thao tác với giỏ hàng'
  if (tools.has('create_shopping_plan')) return 'Đang lập phương án mua'
  if (calls.every((c) => c.tool === 'get_product_details')) return 'Đang xem chi tiết sản phẩm'
  if (tools.has('search_products') || tools.has('search_listings')) return 'Đang tìm trong catalog'
  if (tools.has('present_suggestions')) return 'Đang chốt gợi ý'
  const first = calls[calls.length - 1]
  return LABELS[first.tool] ?? 'Đang tra cứu dữ liệu'
}

function pick(input: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function countOf(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key]
  return Array.isArray(value) ? value.length : undefined
}

/**
 * Ghi mô tả một tool call. Input của model không bao giờ giữ nguyên: chỉ lấy
 * trường có chủ đích, redact PII, cap ký tự — log không thể thành bãi rác PII
 * kể cả khi model nhét SĐT vào `query`.
 */
export function agentCall(tool: string, input: Record<string, unknown>): AgentCall {
  const kind = KIND_BY_TOOL[tool] ?? 'lookup'
  const label = LABELS[tool] ?? `Gọi tool ${tool}`
  let detail: string | undefined
  const ids = countOf(input, 'identifiers')
  switch (tool) {
    case 'search_products':
    case 'search_listings':
      detail = pick(input, 'query', 'category', 'brand')
      break
    case 'get_product_details':
    case 'get_listing':
    case 'get_pricing_context':
      detail = pick(input, 'identifier', 'product_id')
      break
    case 'compare_products':
      detail = ids === undefined ? undefined : `so sánh ${ids} món`
      break
    case 'create_shopping_plan':
      detail = pick(input, 'title') ?? (typeof input.budget === 'number' ? `ngân sách ${input.budget}` : undefined)
      break
    case 'add_to_cart':
      detail = pick(input, 'identifier')
      break
    case 'track_order':
      detail = pick(input, 'order_code')
      break
    case 'search_policies':
      detail = pick(input, 'query')
      break
    case 'update_cart_item':
    case 'remove_from_cart':
      detail = pick(input, 'identifier')
      break
    case 'run_analysis':
      detail = pick(input, 'template')
      break
    case 'draft_campaign_brief':
      detail = pick(input, 'title', 'mechanic')
      break
    case 'stage_price_change':
    case 'stage_stock_change':
    case 'stage_publish_change':
      detail = pick(input, 'summary', 'note')
      break
    default:
      detail = undefined
  }
  return {
    tool,
    label,
    kind,
    ...(detail ? { detail: redactDetail(detail) } : {}),
  }
}

/** Không bao giờ lưu/hiện SĐT, email, mã định danh dài từ input model. */
export function redactDetail(detail: string): string {
  const cleaned = detail
    .replace(/(^|\D)0\d{8,10}(\D|$)/g, '$1[SĐT đã ẩn]$2')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email đã ẩn]')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > MAX_DETAIL_CHARS ? `${cleaned.slice(0, MAX_DETAIL_CHARS - 1)}…` : cleaned
}