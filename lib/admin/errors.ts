const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Phiên đăng nhập admin đã hết hạn. Vui lòng đăng nhập lại.',
  VALIDATION_ERROR: 'Thông tin không hợp lệ. Kiểm tra lại các trường.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  SLUG_TAKEN: 'Slug đã được dùng. Chọn slug khác.',
  SKU_TAKEN: 'SKU đã tồn tại.',
  INVALID_TRANSITION: 'Không thể chuyển trạng thái đơn theo hướng này.',
  INVALID_PAYMENT: 'Không thể cập nhật trạng thái thanh toán.',
  STOCK_CONSTRAINT: 'Số lượng tồn không được nhỏ hơn số đã giữ chỗ.',
  HAS_ORDERS: 'Mục này đã xuất hiện trong đơn hàng — chỉ được archive/tắt.',
  PUBLISH_NEEDS_VARIANT: 'Cần ít nhất một biến thể đang bán trước khi xuất bản.',
  CONFLICT: 'Dữ liệu đã thay đổi. Tải lại trang và thử lại.',
  CONFIGURATION_ERROR: 'Thiếu cấu hình server admin.',
  INTERNAL_ERROR: 'Có lỗi hệ thống. Thử lại sau.',
}

export function adminUserMessage(code: string): string {
  return MESSAGES[code] ?? MESSAGES.INTERNAL_ERROR
}
