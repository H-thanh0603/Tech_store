import type { ReactNode } from 'react'

type ErrorStateProps = {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorState({
  title = 'Đã xảy ra lỗi',
  message,
  action,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-(--radius-lg) border border-danger/30 bg-danger-subtle px-5 py-6"
    >
      <p className="text-(length:--text-base) font-semibold text-danger">{title}</p>
      <p className="mt-1 text-(length:--text-sm) text-fg">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
