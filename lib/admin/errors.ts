const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Phiên đăng nhập admin đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Tài khoản không có quyền thực hiện thao tác này.',
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
  REASON_REQUIRED: 'Thao tác này bắt buộc nhập lý do.',
  SELF_MANAGEMENT_FORBIDDEN: 'Không thể tự khóa, hạ quyền hoặc thu hồi phiên của chính mình.',
  LAST_ADMIN: 'Phải giữ lại ít nhất một tài khoản admin đang hoạt động.',
  AUTH_SYNC_ERROR: 'Quyền đã được khóa an toàn nhưng trạng thái Supabase Auth chưa đồng bộ. Hãy thử lại.',
  MFA_STATE_CHANGED: 'Trạng thái MFA đã thay đổi. Tải lại trang để tiếp tục.',
  MFA_ENROLL_FAILED: 'Không thể tạo mã MFA. Kiểm tra cấu hình TOTP của Supabase.',
  MFA_CODE_INVALID: 'Mã xác minh không đúng hoặc đã hết hạn.',
  MFA_NOT_ENROLLED: 'Tài khoản chưa đăng ký MFA.',
  MFA_RESET_PARTIAL: 'MFA đã được xóa nhưng không thể ghi đủ audit. Kiểm tra log hệ thống.',
  CONFIGURATION_ERROR: 'Thiếu cấu hình server admin.',
  RATE_LIMITED: 'Thử quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  INTERNAL_ERROR: 'Có lỗi hệ thống. Thử lại sau.',
}

export function adminUserMessage(code: string): string {
  return MESSAGES[code] ?? MESSAGES.INTERNAL_ERROR
}
