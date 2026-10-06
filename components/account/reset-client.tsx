'use client'

import { useActionState } from 'react'

import {
  requestPasswordReset,
  updatePasswordAfterReset,
  type AuthFormState,
} from '@/lib/customer/auth-actions'

const INITIAL: AuthFormState = { ok: true }

export function ForgotPasswordClient() {
  const [state, action, pending] = useActionState(requestPasswordReset, INITIAL)
  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Tài khoản TechStore</p>
      <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">Quên mật khẩu</h1>
      <p className="mt-2 text-(length:--text-sm) text-fg-muted">
        Nhập email — nếu tài khoản tồn tại, bạn sẽ nhận link đặt lại (1 lần, hết hạn nhanh).
      </p>
      {state.message ? (
        <p
          role="status"
          className={`mt-4 rounded-(--radius-md) px-3 py-2 text-(length:--text-sm) ${
            state.ok ? 'bg-success-subtle text-fg' : 'bg-danger-subtle text-danger'
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-(length:--text-sm)" htmlFor="f-email">
          Email
          <input id="f-email" name="email" type="email" required className="field-input mt-1" autoComplete="email" />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? 'Đang gửi…' : 'Gửi link đặt lại'}
        </button>
      </form>
    </div>
  )
}

export function ResetPasswordClient() {
  const [state, action, pending] = useActionState(updatePasswordAfterReset, INITIAL)
  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow">Tài khoản TechStore</p>
      <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">Đặt mật khẩu mới</h1>
      <p className="mt-2 text-(length:--text-sm) text-fg-muted">
        Tối thiểu 8 ký tự. Đổi xong, mọi phiên đăng nhập khác sẽ bị đăng xuất.
      </p>
      {state.message ? (
        <p
          role="status"
          className={`mt-4 rounded-(--radius-md) px-3 py-2 text-(length:--text-sm) ${
            state.ok ? 'bg-success-subtle text-fg' : 'bg-danger-subtle text-danger'
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-(length:--text-sm)" htmlFor="r-pass">
          Mật khẩu mới
          <input
            id="r-pass"
            name="password"
            type="password"
            required
            minLength={8}
            className="field-input mt-1"
            autoComplete="new-password"
          />
        </label>
        <label className="block text-(length:--text-sm)" htmlFor="r-confirm">
          Nhập lại mật khẩu
          <input
            id="r-confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            className="field-input mt-1"
            autoComplete="new-password"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-md) bg-brand text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  )
}
