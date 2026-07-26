'use client'

import { useEffect, useId, useRef } from 'react'

import { AdminSidebar } from '@/components/admin/shell/admin-sidebar'
import { makeBackgroundInert, trapDialogTab } from '@/lib/a11y/dialog'
import type { AdminNavItem } from '@/lib/admin/nav-config'

type MobileNavDrawerProps = {
  open: boolean
  onClose: () => void
  items: AdminNavItem[]
}

export function MobileNavDrawer({ open, onClose, items }: MobileNavDrawerProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreBackground = makeBackgroundInert(rootRef.current)

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      else trapDialogTab(event, panelRef.current)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      restoreBackground()
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-fg/40"
        aria-label="Đóng menu điều hướng"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col bg-surface-raised shadow-(--shadow-lg)"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <p id={titleId} className="text-(length:--text-sm) font-semibold text-fg">
            Menu admin
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-(--radius-md) text-fg-muted hover:bg-surface-muted hover:text-fg"
            aria-label="Đóng menu"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1" onClick={onClose}>
          <AdminSidebar items={items} collapsed={false} variant="drawer" />
        </div>
      </div>
    </div>
  )
}
