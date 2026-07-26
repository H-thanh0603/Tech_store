'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { IconChevronDown, IconGrid, navIcon } from '@/components/ui/icons'
import { formatPrice } from '@/lib/format'
import type { MegaPanel, MenuEntry, MenuHighlight, MenuLink } from '@/lib/content/nav-view'

/**
 * Desktop category bar + mega menu.
 *
 * Data comes from `navigation_items` via `buildHeaderNav`, so adding a category
 * is a database change, not a code change.
 *
 * Interaction rules (DESIGN_CELLPHONES_INSPIRED.md §3.4, §13):
 *  - Pointer: hover opens after a short intent delay so passing the cursor
 *    across the bar does not flash panels.
 *  - Keyboard: triggers are buttons with `aria-expanded`/`aria-controls`,
 *    ArrowLeft/ArrowRight move along the bar, Escape closes and restores focus.
 *  - The panel is a plain container of links: no focus trap, so Tab walks
 *    straight through it and out, which is what a menu bar should do.
 */

const HOVER_OPEN_DELAY = 110

type MegaMenuBarProps = {
  entries: MenuEntry[]
  quickLinks: MenuLink[]
}

export function MegaMenuBar({ entries, quickLinks }: MegaMenuBarProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [allOpen, setAllOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const hoverTimer = useRef<number | null>(null)
  const panelId = useId()
  const allPanelId = `${panelId}-all`

  const close = useCallback(() => {
    setOpenId(null)
    setAllOpen(false)
  }, [])

  const scheduleOpen = useCallback((id: string) => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current)
    }
    hoverTimer.current = window.setTimeout(() => {
      setAllOpen(false)
      setOpenId(id)
    }, HOVER_OPEN_DELAY)
  }, [])

  const cancelScheduledOpen = useCallback(() => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
      if (hoverTimer.current !== null) {
        window.clearTimeout(hoverTimer.current)
      }
    }
  }, [close])

  function focusSibling(currentId: string, direction: 1 | -1) {
    const index = entries.findIndex((entry) => entry.id === currentId)
    if (index === -1) {
      return
    }
    const next = entries[(index + direction + entries.length) % entries.length]
    triggerRefs.current.get(next.id)?.focus()
  }

  const active = entries.find((entry) => entry.id === openId) ?? null

  return (
    <div ref={rootRef} className="relative hidden bg-navy text-fg-inverse lg:block">
      <nav aria-label="Danh mục sản phẩm" className="container-store">
        <ul className="flex items-center gap-0.5">
          <li>
            <button
              type="button"
              aria-expanded={allOpen}
              aria-controls={allPanelId}
              onClick={() => {
                setOpenId(null)
                setAllOpen((value) => !value)
              }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) px-3 text-(length:--text-sm) font-semibold transition-colors ${
                allOpen
                  ? 'bg-brand text-accent-fg'
                  : 'text-fg-inverse hover:bg-white/10'
              }`}
            >
              <IconGrid size={18} />
              Tất cả danh mục
              <IconChevronDown size={14} className={allOpen ? 'rotate-180' : undefined} />
            </button>
          </li>

          {entries.map((entry) => {
            const Icon = navIcon(entry.iconKey)
            const isOpen = openId === entry.id
            if (!entry.panel) {
              return (
                <li key={entry.id}>
                  <Link
                    href={entry.href}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg-inverse/85 transition-colors hover:bg-white/10 hover:text-fg-inverse"
                    onMouseEnter={cancelScheduledOpen}
                  >
                    {Icon ? <Icon size={16} /> : null}
                    {entry.label}
                  </Link>
                </li>
              )
            }
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) {
                      triggerRefs.current.set(entry.id, node)
                    } else {
                      triggerRefs.current.delete(entry.id)
                    }
                  }}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onMouseEnter={() => scheduleOpen(entry.id)}
                  onMouseLeave={cancelScheduledOpen}
                  onFocus={() => {
                    // Tabbing onto a trigger must not open its panel (that would
                    // fight the click toggle); it only dismisses a panel opened
                    // by hover so the keyboard user is not left with stale UI.
                    cancelScheduledOpen()
                    setAllOpen(false)
                    setOpenId((current) => (current === entry.id ? current : null))
                  }}
                  onClick={() => {
                    cancelScheduledOpen()
                    setAllOpen(false)
                    setOpenId((current) => (current === entry.id ? null : entry.id))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      focusSibling(entry.id, 1)
                    } else if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      focusSibling(entry.id, -1)
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setAllOpen(false)
                      setOpenId(entry.id)
                    }
                  }}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium transition-colors ${
                    isOpen ? 'bg-white/12 text-fg-inverse' : 'text-fg-inverse/85 hover:bg-white/10'
                  }`}
                >
                  {Icon ? <Icon size={16} /> : null}
                  {entry.label}
                  <IconChevronDown size={14} className="opacity-70" />
                </button>
              </li>
            )
          })}

          <li className="ml-auto">
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-semibold text-brand-electric hover:bg-white/10"
            >
              Xem tất cả sản phẩm →
            </Link>
          </li>
        </ul>
      </nav>

      {allOpen ? (
        <MenuSurface id={allPanelId} label="Tất cả danh mục" onLeave={close}>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => {
                const Icon = navIcon(entry.iconKey)
                return (
                  <li key={`all-${entry.id}`}>
                    <Link
                      href={entry.href}
                      onClick={close}
                      className="flex min-h-11 items-center gap-2.5 rounded-(--radius-md) border border-border px-3 py-2 text-(length:--text-sm) font-medium text-fg transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
                    >
                      {Icon ? <Icon size={18} className="text-brand" /> : null}
                      {entry.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <QuickLinksCard links={quickLinks} onNavigate={close} />
          </div>
        </MenuSurface>
      ) : null}

      {active?.panel ? (
        <MenuSurface id={panelId} label={active.label} onLeave={close}>
          <MegaPanelContent panel={active.panel} onNavigate={close} />
        </MenuSurface>
      ) : null}
    </div>
  )
}

function MenuSurface({
  id,
  label,
  children,
  onLeave,
}: {
  id: string
  label: string
  children: ReactNode
  onLeave: () => void
}) {
  return (
    <div
      id={id}
      aria-label={label}
      onMouseLeave={onLeave}
      className="animate-fade-in absolute inset-x-0 top-full z-50 border-b border-border bg-bg-elevated text-fg shadow-(--shadow-lg)"
    >
      <div className="container-store py-6">{children}</div>
    </div>
  )
}

function MegaPanelContent({ panel, onNavigate }: { panel: MegaPanel; onNavigate: () => void }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
      <div className="grid gap-6 sm:grid-cols-2">
        {panel.groups.map((group) => (
          <MenuColumnView key={group.id} title={group.title} links={group.links} onNavigate={onNavigate} />
        ))}
      </div>
      <MenuColumnView title="Thương hiệu" links={panel.brands} onNavigate={onNavigate} />
      <MenuColumnView title="Theo nhu cầu" links={panel.needs} onNavigate={onNavigate} />
      <div className="flex flex-col gap-5">
        <MenuColumnView title="Mức giá" links={panel.priceBands} onNavigate={onNavigate} />
        <div className="rounded-(--radius-lg) border border-border bg-bg-secondary/70 p-4">
          <p className="text-(length:--text-sm) font-semibold text-fg">{panel.promo.title}</p>
          <p className="mt-1 text-(length:--text-xs) leading-relaxed text-fg-muted">
            {panel.promo.body}
          </p>
          <Link
            href={panel.promo.href}
            onClick={onNavigate}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-(--radius-md) bg-brand px-3 text-(length:--text-xs) font-semibold text-accent-fg hover:bg-brand-hover"
          >
            {panel.promo.ctaLabel}
          </Link>
        </div>
      </div>
      {panel.highlights.length > 0 ? (
        <div className="col-span-full border-t border-border pt-5">
          <HighlightRow highlights={panel.highlights} onNavigate={onNavigate} />
        </div>
      ) : null}
    </div>
  )
}

/** §3.4: "Sản phẩm nổi bật" — up to 4 real, in-stock-agnostic featured cards. */
function HighlightRow({
  highlights,
  onNavigate,
}: {
  highlights: MenuHighlight[]
  onNavigate: () => void
}) {
  return (
    <div>
      <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
        Sản phẩm nổi bật
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {highlights.map((product) => (
          <li key={product.id}>
            <Link
              href={product.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-(--radius-md) border border-border p-2 transition-colors hover:border-brand hover:bg-brand-soft"
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-(--radius-sm) bg-bg-secondary">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.imageAlt ?? product.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-(length:--text-xs) font-medium text-fg">
                  {product.name}
                </span>
                <span className="block text-(length:--text-xs) font-semibold text-brand">
                  {formatPrice(product.minPrice)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MenuColumnView({
  title,
  links,
  onNavigate,
}: {
  title: string
  links: MenuLink[]
  onNavigate: () => void
}) {
  if (links.length === 0) {
    return null
  }
  return (
    <div>
      <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
        {title}
      </p>
      <ul className="mt-3 flex flex-col gap-0.5">
        {links.map((link) => (
          <li key={`${title}-${link.href}-${link.label}`}>
            <Link
              href={link.href}
              onClick={onNavigate}
              className="flex min-h-10 items-center rounded-(--radius-sm) px-2 text-(length:--text-sm) text-fg-muted transition-colors hover:bg-surface-muted hover:text-brand"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function QuickLinksCard({ links, onNavigate }: { links: MenuLink[]; onNavigate: () => void }) {
  return (
    <div className="rounded-(--radius-lg) border border-border bg-bg-secondary/70 p-5">
      <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
        Lối tắt
      </p>
      <ul className="mt-3 flex flex-col gap-0.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              className="flex min-h-10 items-center rounded-(--radius-sm) px-2 text-(length:--text-sm) font-medium text-fg-muted hover:text-brand"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
