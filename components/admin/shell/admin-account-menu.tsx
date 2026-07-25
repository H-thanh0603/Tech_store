'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { adminLogout } from '@/lib/admin/auth-actions'
import type { AdminRole } from '@/lib/admin/permissions'

export function AdminAccountMenu({ role }: { role: AdminRole }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm) font-medium text-fg hover:bg-surface-muted"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle text-(length:--text-xs) font-semibold text-accent"
          aria-hidden="true"
        >
          AD
        </span>
        <span className="hidden sm:inline">Admin</span>
        <span className="sr-only">Mở menu tài khoản</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Tài khoản admin"
          className="absolute right-0 z-40 mt-2 w-52 rounded-(--radius-lg) border border-border bg-surface-raised p-2 shadow-(--shadow-md)"
        >
          <p className="px-2 py-1.5 text-(length:--text-xs) text-fg-muted">
            Vai trò: <span className="font-medium text-fg">{role}</span>
          </p>
          <form action={adminLogout}>
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-(--radius-md) px-2 text-left text-(length:--text-sm) font-medium text-danger hover:bg-danger-subtle"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
