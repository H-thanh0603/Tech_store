'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const KEY = 'techstore_welcome_seen_v1'

export function WelcomeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY)) return
      const t = window.setTimeout(() => setOpen(true), 900)
      return () => window.clearTimeout(t)
    } catch {
      // ignore
    }
  }, [])

  function dismiss() {
    setOpen(false)
    try {
      window.localStorage.setItem(KEY, '1')
    } catch {
      // ignore
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-surface-inverse/50 backdrop-blur-[2px] animate-fade-in"
        aria-label="Đóng"
        onClick={dismiss}
      />
      <div className="relative w-full max-w-md animate-scale-in overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated shadow-(--shadow-lg)">
        <div className="bg-surface-inverse px-6 py-5 text-fg-inverse">
          <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.14em] text-white/50">
            Chào mừng đến TechStore
          </p>
          <h2 id="welcome-title" className="mt-1 text-(length:--text-xl) font-semibold tracking-tight">
            Chọn máy theo việc bạn làm — không cần tài khoản để mua.
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5">
          <ul className="space-y-2 text-(length:--text-sm) text-fg-muted">
            <li className="flex gap-2">
              <span className="text-brand" aria-hidden>
                ✓
              </span>
              Guest checkout COD / chuyển khoản
            </li>
            <li className="flex gap-2">
              <span className="text-brand" aria-hidden>
                ✓
              </span>
              Wishlist & so sánh lưu trên thiết bị
            </li>
            <li className="flex gap-2">
              <span className="text-brand" aria-hidden>
                ✓
              </span>
              Đăng nhập để lưu hồ sơ & theo dõi đơn nhanh
            </li>
          </ul>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Link
              href="/products"
              onClick={dismiss}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-(--radius-md) bg-brand px-4 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
            >
              Xem catalog
            </Link>
            <Link
              href="/account/login"
              onClick={dismiss}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-(--radius-md) border border-border px-4 text-(length:--text-sm) font-semibold text-fg hover:bg-surface-muted"
            >
              Đăng nhập
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2 text-(length:--text-xs) font-medium text-fg-subtle hover:text-fg-muted"
          >
            Tiếp tục mua sắm
          </button>
        </div>
      </div>
    </div>
  )
}
