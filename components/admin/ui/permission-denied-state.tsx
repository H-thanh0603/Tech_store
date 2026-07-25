type PermissionDeniedStateProps = {
  title?: string
  message?: string
}

export function PermissionDeniedState({
  title = 'Không có quyền truy cập',
  message = 'Tài khoản hiện tại không được phép mở module này. Liên hệ quản trị viên nếu bạn cần quyền bổ sung.',
}: PermissionDeniedStateProps) {
  return (
    <div
      role="alert"
      className="rounded-(--radius-lg) border border-border bg-surface-raised px-5 py-10 text-center shadow-(--shadow-sm)"
    >
      <p className="text-(length:--text-lg) font-semibold text-fg">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-(length:--text-sm) text-fg-muted">{message}</p>
    </div>
  )
}
