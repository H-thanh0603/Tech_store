/**
 * Hard scope gate for the assistants: decide BEFORE spending a model call
 * whether the latest user message belongs to the assistant's job.
 *
 * - 'in-scope' → run the turn normally.
 * - 'gray' → run the turn (greetings, follow-ups like "cái thứ 2 thì sao",
 *   or anything ambiguous keep the current soft-redirect behavior).
 * - 'off-topic' → refuse immediately with a canned reply + suggestion
 *   chips, no model call, no budget burned.
 *
 * Keyword-based and intentionally conservative: a message is off-topic only
 * when it hits the blocklist AND shows no in-scope signal. False negatives
 * (gray) are safe — the system prompt still redirects softly.
 */

const SHOPPING_SCOPE_TERMS = [
  // products & advice
  'mua', 'giá', 'bán', 'hàng', 'máy', 'laptop', 'điện thoại', 'dienthoai',
  'phụ kiện', 'phu kien', 'pc', 'màn hình', 'tai nghe', 'loa', 'đồng hồ',
  'tablet', 'tư vấn', 'gợi ý', 'so sánh', 'sosánh', 'compare', 'review',
  'thông số', 'cấu hình', 'chip', 'ram', 'pin', 'sạc', 'bảo hành',
  'khuyến mãi', 'sale', 'giảm giá', 'coupon', 'trả góp', 'còn hàng',
  'hết hàng', 'tồn kho', 'đặt', 'order', 'đơn', 'giỏ', 'cart', 'checkout',
  'thanh toán', 'ship', 'giao hàng', 'vận chuyển', 'đổi trả', 'hoàn tiền',
  'chính sách', 'cửa hàng', 'shop', 'techstore', 'chi nhánh', 'mở cửa',
  'tìm', 'chọn', 'ngân sách', 'triệu', 'nghìn',
  // follow-ups / shopping verbs (kept tight: loose words like "nào"/"xem"
  // would outrank the blocklist, e.g. "thời tiết thế nào", "xem bói")
  'lấy', 'chốt', 'rẻ', 'đắt',
] as const

const MERCHANT_SCOPE_TERMS = [
  'doanh thu', 'doanh số', 'đơn hàng', 'bán', 'lợi nhuận', 'tồn kho',
  'hết hàng', 'sắp hết', 'nhập hàng', 'restock', 'kho', 'sản phẩm',
  'listing', 'catalog', 'giá', 'sale', 'khuyến mãi', 'campaign',
  'chiến dịch', 'xuất bản', 'publish', 'ẩn', 'archive', 'báo cáo',
  'thống kê', 'phân tích', 'hiệu quả', 'bán chạy', 'bán chậm',
  'khách hàng', 'kinh doanh', 'cửa hàng', 'shop', 'brief', 'digest',
  'bản tin', 'stage', 'duyệt', 'áp dụng', 'doanh nghiệp', 'vận hành',
] as const

/** Topics that are never this assistant's job (shopping + merchant share). */
const OFFTOPIC_BLOCK_TERMS = [
  // politics & news
  'bầu cử', 'chính trị', 'đảng', 'tổng thống', 'thủ tướng', 'quốc hội',
  // schoolwork / coding / general knowledge
  'làm bài tập', 'giải toán', 'viết code', 'viết luận', 'luận văn',
  'thủ đô của', 'thời tiết', 'dự báo thời tiết', 'tỷ giá', 'chứng khoán',
  // clearly non-shopping services
  'đặt vé máy bay', 'đặt phòng khách sạn', 'tra cứu luật', 'tư vấn luật',
  'khám bệnh', 'kê đơn', 'tư vấn y tế', 'xem bói', 'tử vi',
  // wrongdoing (also caught by jailbreak detector when phrased as override)
  'làm bom', 'chế tạo vũ khí', 'hack tài khoản', 'hack facebook',
  'lừa đảo', 'làm giả', 'tấn công mạng', 'ddos',
] as const

export type ScopeVerdict = 'in-scope' | 'gray' | 'off-topic'

function includesAny(text: string, terms: readonly string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some((t) => lower.includes(t))
}

export function checkShoppingScope(text: string): ScopeVerdict {
  if (includesAny(text, SHOPPING_SCOPE_TERMS)) return 'in-scope'
  if (includesAny(text, OFFTOPIC_BLOCK_TERMS)) return 'off-topic'
  return 'gray'
}

export function checkMerchantScope(text: string): ScopeVerdict {
  if (includesAny(text, MERCHANT_SCOPE_TERMS)) return 'in-scope'
  if (includesAny(text, OFFTOPIC_BLOCK_TERMS)) return 'off-topic'
  return 'gray'
}

export const SHOPPING_SCOPE_REFUSAL =
  'Mình chỉ hỗ trợ mua sắm trong TechStore (tìm hàng, so sánh, giỏ, đơn, chính sách) nên câu này mình xin phép không trả lời. Bạn cần tìm máy gì không?'

export const SHOPPING_SCOPE_SUGGESTIONS = [
  'Laptop nào pin trâu cho sinh viên, dưới 20 triệu?',
  'So sánh 2 máy rẻ nhất — nên chọn máy nào?',
  'Đang có deal nào hot không?',
]

export const MERCHANT_SCOPE_REFUSAL =
  'Mình chỉ hỗ trợ vận hành TechStore (doanh thu, tồn kho, đơn chờ xử lý, stage giá/tồn/xuất bản) nên câu này mình xin phép không trả lời.'

export const MERCHANT_SCOPE_SUGGESTIONS = [
  'Doanh thu 7 ngày qua?',
  'Hàng nào sắp hết?',
  'Đơn nào đang chờ xử lý?',
]
