/**
 * Static policy passages for `search_policies`. Transcribed from the
 * storefront legal pages (return-policy; terms/privacy are linked, not quoted)
 * so the assistant only states terms the store actually publishes.
 *
 * To extend: add a passage here AND keep the source page in sync.
 * Full pages: /return-policy, /terms, /privacy.
 */

export interface PolicyPassage {
  id: string
  title: string
  text: string
  href: string
  keywords: string[]
}

const PASSAGES: PolicyPassage[] = [
  {
    id: 'returns-summary',
    title: 'Tóm tắt đổi trả',
    text: 'Hàng lỗi/hỏng: đổi miễn phí trong 7 ngày. Nhận sai sản phẩm hoặc không đúng mô tả: shop chịu toàn bộ chi phí. Đổi ý: vẫn được trả, có thể mất phí. Yêu cầu trả hàng tạo trực tiếp từ trang đơn hàng. Shop phản hồi trong 24 giờ.',
    href: '/return-policy',
    keywords: ['đổi trả', 'trả hàng', 'tóm tắt', 'chính sách'],
  },
  {
    id: 'returns-howto',
    title: 'Cách gửi yêu cầu trả hàng',
    text: 'Mở trang đơn hàng, chọn sản phẩm cần trả và gửi yêu cầu kèm lý do: lỗi/hỏng, nhận sai sản phẩm, không đúng mô tả, đổi ý, hoặc lý do khác. Không có tài khoản thì vào trang theo dõi đơn hàng bằng mã đơn + số điện thoại.',
    href: '/return-policy',
    keywords: ['cách', 'gửi yêu cầu', 'trả hàng', 'lý do', 'track-order', 'theo dõi'],
  },
  {
    id: 'returns-defect-7d',
    title: 'Hàng lỗi — đổi miễn phí 7 ngày',
    text: 'Sản phẩm lỗi từ nhà sản xuất hoặc hỏng trong 7 ngày đầu tính từ ngày nhận được đổi mới miễn phí, shop chịu phí vận chuyển hai chiều. Hết 7 ngày chuyển sang chế độ bảo hành chính hãng.',
    href: '/return-policy',
    keywords: ['lỗi', 'hỏng', '7 ngày', 'đổi mới', 'miễn phí', 'bảo hành'],
  },
  {
    id: 'returns-wrong-item',
    title: 'Nhận sai hoặc không đúng mô tả',
    text: 'Shop giao sai model, sai phụ kiện, hoặc sản phẩm khác mô tả trên website: đổi đúng hàng hoặc trả hoàn toàn tiền, shop chịu mọi chi phí.',
    href: '/return-policy',
    keywords: ['sai', 'nhầm', 'không đúng mô tả', 'đổi', 'tiền'],
  },
  {
    id: 'returns-changed-mind',
    title: 'Đổi ý',
    text: 'Không thích màu, muốn lên đời, mua nhầm — vẫn trả được trong 7 ngày, hàng nguyên vẹn đủ hộp phụ kiện. Trường hợp này có thể mất phí (vận chuyển, kiểm định lại), mức phí shop báo trước khi bạn xác nhận, không có phí ẩn.',
    href: '/return-policy',
    keywords: ['đổi ý', 'không thích', 'lên đời', 'mua nhầm', 'phí'],
  },
  {
    id: 'returns-refund',
    title: 'Hoàn tiền',
    text: 'Yêu cầu được duyệt, shop hoàn tiền theo đúng phương thức thanh toán gốc: COD chuyển khoản lại, chuyển khoản/VietQR hoàn về tài khoản đã thanh toán, VNPay hoàn qua cổng VNPay (thời gian phụ thuộc ngân hàng). Thời gian hoàn tiền thường 1–5 ngày làm việc kể từ khi duyệt.',
    href: '/return-policy',
    keywords: ['hoàn tiền', 'refund', 'cod', 'vnpay', 'vietqr', 'chuyển khoản', 'bao lâu'],
  },
  {
    id: 'returns-reject',
    title: 'Hàng không nhận trả',
    text: 'Không nhận trả: hàng đã kích hoạt bảo hành chính hãng hoặc mã region lock; hỏng do dùng sai, vào nước, rơi vỡ do khách; phụ kiện tiêu hao đã qua sử dụng.',
    href: '/return-policy',
    keywords: ['không nhận', 'từ chối', 'kích hoạt', 'vào nước', 'rơi vỡ'],
  },
  {
    id: 'returns-pickup',
    title: 'Đổi trả đơn nhận tại cửa hàng',
    text: 'Đơn pickup tại shop đổi/trả trực tiếp tại quầy — nhân viên kiểm tra và xử lý ngay trong giờ, không cần chờ luồng online.',
    href: '/return-policy',
    keywords: ['pickup', 'cửa hàng', 'nhận tại shop', 'quầy'],
  },
  {
    id: 'terms-pointer',
    title: 'Điều khoản sử dụng',
    text: 'Quy định chung khi mua hàng tại TechStore. Xem chi tiết tại trang Điều khoản sử dụng.',
    href: '/terms',
    keywords: ['điều khoản', 'quy định', 'mua hàng'],
  },
  {
    id: 'privacy-pointer',
    title: 'Chính sách bảo mật',
    text: 'Cách TechStore thu thập và sử dụng dữ liệu của bạn. Xem chi tiết tại trang Chính sách bảo mật.',
    href: '/privacy',
    keywords: ['bảo mật', 'dữ liệu', 'riêng tư', 'privacy'],
  },
  {
    id: 'shipping-pointer',
    title: 'Giao hàng & thanh toán',
    text: 'TechStore giao hàng toàn quốc, thanh toán COD, chuyển khoản/VietQR hoặc VNPay. Phí ship hiển thị ở bước thanh toán trước khi bạn đặt hàng.',
    href: '/checkout',
    keywords: ['giao hàng', 'vận chuyển', 'ship', 'phí ship', 'thanh toán', 'payment'],
  },
]

export function searchPolicies(query: string, limit = 3): PolicyPassage[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-zà-ỹ0-9]+/iu)
    .filter((t) => t.length > 1)
  if (tokens.length === 0) return PASSAGES.slice(0, limit)

  const scored = PASSAGES.map((p) => {
    const hay = `${p.title} ${p.text} ${p.keywords.join(' ')}`.toLowerCase()
    let score = 0
    for (const t of tokens) {
      if (p.keywords.some((k) => k.includes(t) || t.includes(k))) score += 2
      else if (hay.includes(t)) score += 1
    }
    return { p, score }
  }).filter((s) => s.score > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.p)
}
