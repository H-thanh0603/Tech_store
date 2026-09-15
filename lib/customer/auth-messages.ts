/**
 * GoTrue leaks English infra errors (notably the built-in email provider's
 * 2–4 mails/hour project-wide cap: "email rate limit exceeded"). Translate
 * them so customers get an actionable message instead of raw API text.
 *
 * Plain module (no 'use server'): Server Actions files may only export
 * async functions.
 */
export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('signups not allowed')) {
    return 'Đăng ký email chưa bật trên Supabase. Bật Email provider trong Auth settings.'
  }
  if (lower.includes('email rate limit exceeded') || lower.includes('over_email_send_rate_limit')) {
    return 'Hệ thống gửi mail đang quá tải (giới hạn mail/giờ của Supabase). Thử lại sau khoảng 1 giờ, hoặc đăng nhập bằng mật khẩu.'
  }
  if (lower.includes('email address not authorized')) {
    return 'Địa chỉ này chưa nhận được mail xác thực (Supabase chỉ gửi cho thành viên team khi chưa cấu hình SMTP riêng).'
  }
  return message
}
