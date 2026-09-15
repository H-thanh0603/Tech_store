'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { makeBackgroundInert, trapDialogTab } from '@/lib/a11y/dialog'

export function CatalogFilterDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Same modal pattern as the nav drawer (FE-801): focus into the panel,
    // trap Tab, inert the background, restore focus on close. The content
    // area no longer closes on any inner click — only overlay/Escape/× do.
    const previouslyFocused = document.activeElement as HTMLElement | null
    const trigger = triggerRef.current
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreBackground = makeBackgroundInert(rootRef.current)
    panelRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
      else trapDialogTab(e, panelRef.current)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      restoreBackground()
      ;(previouslyFocused ?? trigger)?.focus?.()
    }
  }, [open])

  return (
    <div className="lg:hidden" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="catalog-filter-panel"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-(--radius-md) border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold text-fg shadow-(--shadow-sm)"
      >
        Bộ lọc
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-fg/40"
            aria-label="Đóng bộ lọc"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id="catalog-filter-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-bg-elevated shadow-(--shadow-lg)"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p id={titleId} className="font-semibold">
                Bộ lọc
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-(--radius-md) text-fg-muted hover:bg-surface-muted"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
