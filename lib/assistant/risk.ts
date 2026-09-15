/**
 * Order risk engine (điểm 7 — Agentic Order Processing + điểm 8 — Fraud flags).
 *
 * Đánh giá rủi ro một đơn hàng bằng quy tắc Allstring (không LLM) — các hành
 * động rủi ro KHÔNG BAO GIỜ do agent tự quyết:
 *   low    → gợi ý auto-process (nhân viên vẫn thấy và có thể giữ lại)
 *   medium → agent phải hỏi người vận hành trước khi đề xuất xử lý tiếp
 *   high   → giữ đơn, chỉ human xử lý
 *
 * Engine chỉ là LỚP ĐỀ XUẤT: trạng thái đơn chỉ đổi qua order-actions đã có
 * (staff bấm trong trang quản trị). Fail-soft: lỗi đọc dữ liệu → trả null,
 * agent báo không đánh giá được thay vì bịa mức rủi ro.
 */

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskFactor {
  code: string
  label: string
  /** Mức độ nặng: mỗi factor kéo điểm risk một khoảng. */
  weight: number
}

export interface RiskAssessment {
  level: RiskLevel
  score: number
  factors: RiskFactor[]
  recommendation: string
}

/** Ngưỡng điểm: < LOW_AT là low, từ LOW_AT đến < HIGH_AT là medium, ≥ HIGH_AT là high. */
const LOW_AT = 30
const HIGH_AT = 60

/** Đơn giá trị cao (VND) — factor fraud kinh điển của video. */
const BIG_TICKET_VND = 20_000_000
/** Đơn guest (không account) giá trị cao hơn ngưỡng → đáng ngờ hơn. */
const GUEST_BIG_TICKET_VND = 12_000_000
/** Số dòng item bất thường (đơn thật thường 1-6 dòng). */
const MANY_LINES = 8

function isBigTicket(total: number, isGuest: boolean): boolean {
  return total >= (isGuest ? GUEST_BIG_TICKET_VND : BIG_TICKET_VND)
}

export interface OrderRiskInput {
  total: number
  /** Số dòng item trong đơn. */
  itemCount: number
  /** Đơn của khách không có account (guest checkout). */
  isGuest: boolean
  /** Phương thức thanh toán: 'cod' | 'bank_transfer'. */
  paymentMethod: string
  /** Số đơn hoàn/trả của cùng khách (theo SĐT) trong 90 ngày, nếu biết. */
  priorReturns?: number
  /** Số đơn đã hoàn tất của cùng khách trong 90 ngày, nếu biết. */
  priorCompleted?: number
  /** Số đơn bị hủy/hết hạn của cùng khách trong 90 ngày, nếu biết. */
  priorCancelled?: number
}

function recommendationFor(level: RiskLevel, factors: RiskFactor[]): string {
  if (level === 'high') {
    return 'Giữ đơn, liên hệ xác minh trước khi xử lý. Agent không tự xử lý đơn rủi ro cao.'
  }
  if (level === 'medium') {
    return 'Kiểm tra nhanh thông tin liên hệ rồi mới xử lý; agent chỉ được đề xuất, người vận hành chốt.'
  }
  return factors.length === 0
    ? 'Không có tín hiệu rủi ro — đủ điều kiện xử lý tự động.'
    : 'Rủi ro thấp — đủ điều kiện xử lý tự động, vẫn theo dõi khi gói hàng.'
}

/**
 * Chấm điểm rủi ro đơn hàng. Trong suốt: mỗi factor có mã + nhãn hiển thị
 * được, tổng điểm quyết định mức. Không bao giờ ném lỗi với input kỳ lạ.
 */
export function assessOrderRisk(input: OrderRiskInput): RiskAssessment {
  const factors: RiskFactor[] = []
  const total = Number.isFinite(input.total) ? Math.max(input.total, 0) : 0
  const isGuest = input.isGuest

  if (isBigTicket(total, isGuest)) {
    factors.push({
      code: 'big_ticket',
      label: isGuest
        ? 'Khách vãng lai + đơn giá trị cao'
        : 'Đơn giá trị cao',
      weight: isGuest ? 35 : 20,
    })
  }
  if (input.paymentMethod === 'cod' && isBigTicket(total, isGuest)) {
    factors.push({
      code: 'cod_big_ticket',
      label: 'COD cho đơn giá trị cao (rủi ro từ chối nhận)',
      weight: 15,
    })
  }
  if (Number.isFinite(input.itemCount) && input.itemCount >= MANY_LINES) {
    factors.push({
      code: 'many_lines',
      label: `Nhiều dòng sản phẩm bất thường (${input.itemCount})`,
      weight: 10,
    })
  }
  const priorReturns = input.priorReturns ?? 0
  if (priorReturns >= 2) {
    factors.push({
      code: 'return_history',
      label: `Khách có ${priorReturns} đơn hoàn/trả trong 90 ngày`,
      weight: 25,
    })
  }
  const priorCancelled = input.priorCancelled ?? 0
  if (priorCancelled >= 3 && (input.priorCompleted ?? 0) === 0) {
    factors.push({
      code: 'cancel_history',
      label: `Chỉ có ${priorCancelled} đơn bị hủy/hết hạn, chưa có đơn hoàn tất`,
      weight: 30,
    })
  }
  if (isGuest && input.paymentMethod === 'bank_transfer' && total >= 5_000_000) {
    factors.push({
      code: 'guest_transfer',
      label: 'Khách vãng lai chuyển khoản số tiền lớn (khó truy về chủ thẻ)',
      weight: 15,
    })
  }

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.weight, 0))
  const level: RiskLevel = score >= HIGH_AT ? 'high' : score >= LOW_AT ? 'medium' : 'low'
  return { level, score, factors, recommendation: recommendationFor(level, factors) }
}

/** Nhãn mức rủi ro đọc được (UI + agent reply). */
export function riskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'Thấp'
    case 'medium':
      return 'Trung bình'
    case 'high':
      return 'Cao'
  }
}
