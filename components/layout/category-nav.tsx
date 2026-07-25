'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { CATEGORY_NAV, QUICK_LINKS } from '@/lib/customer/categories'

export function CategoryNavDesktop() {
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenSlug(null)
    }
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenSlug(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [])

  const active = CATEGORY_NAV.find((c) => c.slug === openSlug)

  return (
    <nav
      ref={rootRef}
      aria-label="Danh mục"
      className="relative hidden border-t border-border lg:block"
    >
      <div className="container-store flex items-center gap-0.5 py-1">
        <button
          type="button"
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-(--radius-md) px-3 text-(length:--text-sm) font-semibold transition-colors ${
            openSlug
              ? 'bg-brand text-accent-fg'
              : 'bg-surface-muted text-fg hover:bg-brand-soft hover:text-brand'
          }`}
          aria-expanded={Boolean(openSlug)}
          aria-controls={panelId}
          onClick={() => setOpenSlug((s) => (s ? null : CATEGORY_NAV[0]?.slug ?? null))}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 7h16M4 12h10M4 17h16" strokeLinecap="round" />
          </svg>
          Danh mục
          <span aria-hidden className="text-(length:--text-xs) opacity-80">
            ▾
          </span>
        </button>

        {CATEGORY_NAV.map((item) => (
          <div key={item.slug} className="relative">
            <button
              type="button"
              className={`inline-flex min-h-11 shrink-0 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium transition-colors ${
                openSlug === item.slug
                  ? 'bg-surface-muted text-fg'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`}
              onMouseEnter={() => item.children?.length && setOpenSlug(item.slug)}
              onFocus={() => item.children?.length && setOpenSlug(item.slug)}
              onClick={() => {
                if (item.children?.length) {
                  setOpenSlug((s) => (s === item.slug ? null : item.slug))
                } else {
                  window.location.href = item.href
                }
              }}
              aria-expanded={openSlug === item.slug}
            >
              {item.label}
              {item.children?.length ? (
                <span className="ml-1 text-(length:--text-xs) opacity-60" aria-hidden>
                  ▾
                </span>
              ) : null}
            </button>
          </div>
        ))}

        <Link
          href="/products"
          className="ml-auto inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-brand hover:bg-brand-soft"
        >
          Xem tất cả →
        </Link>
      </div>

      {active?.children?.length ? (
        <div
          id={panelId}
          className="animate-fade-in absolute inset-x-0 top-full z-50 border-b border-border bg-bg-elevated shadow-(--shadow-lg)"
          onMouseLeave={() => setOpenSlug(null)}
        >
          <div className="container-store grid gap-8 py-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                {active.label}
              </p>
              {active.description ? (
                <p className="mt-1 max-w-md text-(length:--text-sm) text-fg-muted">{active.description}</p>
              ) : null}
              <ul className="mt-4 grid gap-1 sm:grid-cols-2">
                {active.children.map((child) => (
                  <li key={child.slug}>
                    <Link
                      href={child.href}
                      className="flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg transition-colors hover:bg-surface-muted"
                      onClick={() => setOpenSlug(null)}
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-(--radius-lg) border border-border bg-bg-secondary/60 p-5">
              <p className="text-(length:--text-xs) font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                Lối tắt
              </p>
              <ul className="mt-3 flex flex-col gap-1">
                {QUICK_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-10 items-center text-(length:--text-sm) font-medium text-fg-muted hover:text-brand"
                      onClick={() => setOpenSlug(null)}
                    >
                      {link.label} →
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={active.href}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-brand px-4 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
                onClick={() => setOpenSlug(null)}
              >
                Vào {active.label}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  )
}

export function CategoryNavMobile({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      {CATEGORY_NAV.map((item) => {
        const hasChildren = Boolean(item.children?.length)
        const expanded = open === item.slug
        return (
          <div key={item.slug}>
            {hasChildren ? (
              <>
                <button
                  type="button"
                  className="flex w-full min-h-11 items-center justify-between rounded-(--radius-md) px-3 text-left text-(length:--text-sm) font-medium text-fg hover:bg-surface-muted"
                  aria-expanded={expanded}
                  onClick={() => setOpen((s) => (s === item.slug ? null : item.slug))}
                >
                  {item.label}
                  <span aria-hidden className="text-fg-subtle">
                    {expanded ? '▴' : '▾'}
                  </span>
                </button>
                {expanded ? (
                  <ul className="mb-1 ml-2 border-l border-border pl-2">
                    <li>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className="flex min-h-10 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-brand"
                      >
                        Xem tất cả {item.label}
                      </Link>
                    </li>
                    {item.children!.map((child) => (
                      <li key={child.slug}>
                        <Link
                          href={child.href}
                          onClick={onNavigate}
                          className="flex min-h-10 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <Link
                href={item.href}
                onClick={onNavigate}
                className="flex min-h-11 items-center rounded-(--radius-md) px-3 text-(length:--text-sm) font-medium text-fg hover:bg-surface-muted"
              >
                {item.label}
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
