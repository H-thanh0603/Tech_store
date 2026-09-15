/**
 * Agent permission matrix (điểm 4 — Dynamic RBAC + AI Permission).
 *
 * Nguyên tắc: agent KHÔNG được cấp quyền trực tiếp vào database. Mọi thao tác
 * đi qua tool; ma trận này chặn tool call trước khi chạm backend:
 *   - `deny`     → tool không bao giờ chạy với agent này (một số tool chỉ có
 *                  cho human: xóa sản phẩm, đổi giá trực tiếp, hoàn tiền...).
 *   - `approval` → tool chỉ tạo bản nháp/đề xuất; người vận hành duyệt rồi
 *                  hệ thống mới thực thi (staged changes, campaign brief).
 *   - `allow`    → read-only hoặc ghi an toàn đã gate ở tầng dưới (giỏ hàng
 *                  của chính khách, quantity 1-10, provenance).
 *
 * Không thuộc ma trận → mặc định từ chối (fail-closed).
 */

export type AgentEffect = 'allow' | 'approval' | 'deny'

export interface AgentPermissionRule {
  effect: AgentEffect
  /** Lý do ngắn khi bị chặn (hiện cho model + log). */
  reason?: string
}

const DENY_ADMIN_WRITE: AgentPermissionRule = {
  effect: 'deny',
  reason: 'Tool này chỉ dành cho người vận hành. Agent không tự sửa dữ liệu cửa hàng.',
}

/** Shopping agent (khách hàng): đọc catalog + giỏ hàng của chính khách. */
export const SHOPPING_AGENT_PERMISSIONS: Record<string, AgentPermissionRule> = {
  search_products: { effect: 'allow' },
  get_product_details: { effect: 'allow' },
  compare_products: { effect: 'allow' },
  create_shopping_plan: { effect: 'allow' },
  get_fulfillment_options: { effect: 'allow' },
  search_policies: { effect: 'allow' },
  get_cart: { effect: 'allow' },
  add_to_cart: { effect: 'allow' },
  update_cart_item: { effect: 'allow' },
  remove_from_cart: { effect: 'allow' },
  start_checkout: { effect: 'allow' },
  track_order: { effect: 'allow' },
  get_order_history: { effect: 'allow' },
  present_suggestions: { effect: 'allow' },
  // Admin tools không bao giờ xuất hiện với khách — chặn phòng hờ nếu model
  // bị lừa gọi tên tool admin (cũng không nằm trong tool list gửi đi).
  stage_publish_change: DENY_ADMIN_WRITE,
  stage_price_change: DENY_ADMIN_WRITE,
  stage_stock_change: DENY_ADMIN_WRITE,
  get_business_snapshot: DENY_ADMIN_WRITE,
  run_analysis: DENY_ADMIN_WRITE,
}

/** Merchant agent (nhân viên vận hành): đọc số liệu + STAGE thay đổi. */
export const MERCHANT_AGENT_PERMISSIONS: Record<string, AgentPermissionRule> = {
  get_business_snapshot: { effect: 'allow' },
  get_inventory_alerts: { effect: 'allow' },
  get_order_issues: { effect: 'allow' },
  search_listings: { effect: 'allow' },
  get_listing: { effect: 'allow' },
  get_pricing_context: { effect: 'allow' },
  get_pending_changes: { effect: 'allow' },
  list_campaign_briefs: { effect: 'allow' },
  get_latest_digest: { effect: 'allow' },
  run_analysis: { effect: 'allow' },
  draft_campaign_brief: { effect: 'approval' },
  stage_publish_change: { effect: 'approval' },
  stage_price_change: { effect: 'approval' },
  stage_stock_change: { effect: 'approval' },
  present_suggestions: { effect: 'allow' },
  // Không có bất kỳ tool xóa/hoàn tiền/đổi giá trực tiếp nào cho agent —
  // kể cả admin-actor. delete_product / refund / direct price vẫn là human-only.
}

const DENIED_REPLY =
  'Tool này không nằm trong quyền của trợ lý. Bạn cần thao tác này thì làm trực tiếp trong trang quản trị nhé.'

/** Xét quyền một tool call. Không có rule → fail-closed (deny). */
export function checkAgentPermission(
  matrix: Record<string, AgentPermissionRule>,
  tool: string,
): AgentPermissionRule {
  return matrix[tool] ?? { effect: 'deny', reason: DENIED_REPLY }
}

/** Reply mẫu khi từ chối — dùng cho cả 2 agent để giọng điệu nhất quán. */
export function permissionDeniedReply(rule: AgentPermissionRule): string {
  return rule.reason ?? DENIED_REPLY
}
