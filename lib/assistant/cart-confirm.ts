/**
 * Human-confirm gate for shopping-assistant cart writes (H2).
 *
 * The model asserting `confirmed === true` is NOT sufficient: a
 * prompt-injected or misheard "đồng ý" could otherwise move a real guest
 * cart from a public endpoint. Every add/update/remove therefore needs BOTH:
 *   1. model-asserted `confirmed: true` in the tool input, AND
 *   2. server-observed human intent in the latest user message
 *      (hasHumanCartConfirm) — an explicit cart verb or confirmation phrase
 *      the attacker cannot forge without the human actually typing it.
 *
 * Checkout already returns only a link (no order placed) — this gate extends
 * the same containment to the cart itself.
 */

// Explicit cart verbs + confirmation phrases (VI + minimal EN).
const HUMAN_CART_RE = new RegExp(
  [
    'thêm', 'them\\b', 'mua\\b', 'lấy', 'lay\\b', 'cho\\b.*(vào giỏ|vao gio)',
    'bỏ vào', 'bo vao', 'đặt', 'dat\\b', 'chốt', 'chot\\b',
    'xóa', 'xoa\\b', 'bỏ\\b', 'bo\\b', 'hủy món', 'đổi số lượng', 'doi so luong',
    'tăng', 'tang\\b', 'giảm', 'giam\\b', 'đồng ý', 'dong y', 'xác nhận', 'xac nhan',
    'đúng rồi', 'dung roi', 'ok\\b', 'oke\\b', 'yes\\b', 'ừ\\b', 'uh\\b', 'lấy luôn',
    'lấy con', 'lấy em', 'lấy món',
  ].join('|'),
  'i',
)

/** True when the latest user message shows human cart/checkout intent. */
export function hasHumanCartConfirm(text: string): boolean {
  return HUMAN_CART_RE.test((text ?? '').slice(0, 1000))
}

export const CART_CONFIRM_HINT =
  'Thao tác giỏ cần khách xác nhận rõ trong tin nhắn mới nhất (vd: "thêm giúp mình", "lấy con này", "đồng ý"). ' +
  'Tóm tắt món + số lượng và hỏi xác nhận trước — chưa đụng vào giỏ.'
