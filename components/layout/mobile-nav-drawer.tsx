'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { IconChevronDown, IconClose, navIcon } from '@/components/ui/icons'
import type { MenuEntry, MenuLink } from '@/lib/content/nav-view'

/**
 * Mobile category drawer.
 *
 * A modal dialog: the page behind it is inert to screen readers via
 * `aria-modal`, focus moves into the panel on open and returns to the trigger on
 * close, Escape closes, and body scroll is locked while it is open.
 *
 * Depth is intentionally capped at two levels; a third level on a phone becomes
 * a maze. Level-3 entries are flattened into their parent group.
 */

type MobileNavDrawerProps = {
  open: boolean
  entries: MenuEntry[]
  quickLinks: MenuLink[]
  onClose: () => void
}

export function MobileNavDrawer({ open, entries, quickLinks, onClose }: MobileNavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Đóng menu"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-navy-deep/55"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Danh mục và điều hướng"
        tabIndex={-1}
        className="animate-fade-in absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col bg-bg-elevated shadow-(--shadow-lg)"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-(length:--text-sm) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
            Danh mục
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-(--radius-md) text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            <IconClose />
          </button>
        </div>

        <nav aria-label="Danh mục sản phẩm (mobile)" className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col">
            {entries.map((entry) => {
              const Icon = navIcon(entry.iconKey)
              const expanded = expandedId === entry.id
              const groupLinks = entry.panel
                ? entry.panel.groups.flatMap((group) => group.links)
                : []

              return (
                <li key={entry.id}>
                  <div className="flex items-center">
                    <Link
                      href={entry.href}
                      onClick={onClose}
                      className="flex min-h-12 flex-1 items-center gap-2.5 rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg hover:bg-surface-muted"
                    >
                      {Icon ? <Icon size={18} className="text-brand" /> : null}
                      {entry.label}
                    </Link>
                    {groupLinks.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Thu gọn' : 'Mở rộng'} ${entry.label}`}
                        onClick={() => setExpandedId(expanded ? null : entry.id)}
                        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-(--radius-md) text-fg-subtle hover:bg-surface-muted hover:text-fg"
                      >
                        <IconChevronDown className={expanded ? 'rotate-180' : undefined} />
                      </button>
                    ) : null}
                  </div>

                  {expanded && entry.panel ? (
                    <div className="mb-2 ml-4 border-l border-border pl-2">
                      <ul className="flex flex-col">
                        {groupLinks.map((link) => (
                          <li key={`${entry.id}-${link.href}-${link.label}`}>
                            <Link
                              href={link.href}
                              onClick={onClose}
                              className="flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 px-3 text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
                        Mức giá
                      </p>
                      <ul className="flex flex-col">
                        {entry.panel.priceBands.map((band) => (
                          <li key={`${entry.id}-price-${band.href}`}>
                            <Link
                              href={band.href}
                              onClick={onClose}
                              className="flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
                            >
                              {band.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <div className="mt-4 border-t border-border pt-3">
            <p className="px-3 pb-1 text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
              Lối tắt
            </p>
            <ul className="flex flex-col">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </div>
  )
}
