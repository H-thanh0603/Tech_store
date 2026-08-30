import type { CommerceErrorCode } from '@/lib/commerce/types'

const USER_MESSAGES: Record<CommerceErrorCode, string> = {
  VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  CART_EMPTY: 'Giỏ hàng đang trống.',
  CART_NOT_FOUND: 'Không tìm thấy giỏ hàng.',
  ITEM_NOT_FOUND: 'Không tìm thấy sản phẩm trong giỏ hàng.',
  PRODUCT_UNAVAILABLE: 'Sản phẩm hiện không khả dụng.',
  OUT_OF_STOCK: 'Sản phẩm không đủ số lượng trong kho.',
  PRICE_CHANGED: 'Giá sản phẩm đã thay đổi. Vui lòng kiểm tra lại giỏ hàng.',
  COUPON_INVALID: 'Mã giảm giá không hợp lệ.',
  COUPON_EXPIRED: 'Mã giảm giá đã hết hạn.',
  COUPON_EXHAUSTED: 'Mã giảm giá đã hết lượt sử dụng.',
  COUPON_MINIMUM: 'Đơn hàng chưa đạt giá trị tối thiểu của mã giảm giá.',
  IDEMPOTENT_REPLAY: 'Đơn hàng đã được tạo trước đó.',
  ORDER_NOT_FOUND: 'Không tìm thấy đơn hàng với thông tin đã cung cấp.',
  RATE_LIMITED: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.',
  NOT_RETURNABLE: 'Đơn hàng ở trạng thái hiện tại không thể yêu cầu trả hàng.',
  RETURN_ALREADY_REQUESTED: 'Đơn hàng này đã có yêu cầu trả hàng.',
  CONFIGURATION_ERROR: 'Hệ thống thanh toán chưa được cấu hình.',
  INTERNAL_ERROR: 'Có lỗi xảy ra. Vui lòng thử lại.',
}

const COMMERCE_CODES = new Set<CommerceErrorCode>(
  Object.keys(USER_MESSAGES) as CommerceErrorCode[],
)

export function isCommerceErrorCode(value: unknown): value is CommerceErrorCode {
  return typeof value === 'string' && COMMERCE_CODES.has(value as CommerceErrorCode)
}

export function toUserMessage(error: unknown): string {
  if (isCommerceErrorCode(error)) {
    return USER_MESSAGES[error]
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (isCommerceErrorCode(code)) {
      return USER_MESSAGES[code]
    }
  }

  return USER_MESSAGES.INTERNAL_ERROR
}
