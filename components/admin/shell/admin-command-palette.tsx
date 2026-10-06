'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AdminNavItem } from '@/lib/admin/nav-config'

type SearchRow = { href: string; title: string; subtitle: string }
type SearchResult = { orders: SearchRow[]; products: SearchRow[]; customers: SearchRow[] }

const EMPTY: SearchResult = { orders: [], products: [], customers: [] }

function matchesNav(items: AdminNavItem[], q: string): AdminNavItem[] {
  const needle = q.trim().toLowerCase()
  if (needle.length < 2) return []
  return items.filter((item) => item.label.toLowerCase().includes(needle)).slice(0, 5)
}

export function AdminCommandPalette({ items }: { items: AdminNavItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult>(EMPTY)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResult(EMPTY)
    setActive(0)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        close()
      } else if (e.key === '/' && !open && !typing) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || query.trim().length < 2) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) setResult((await res.json()) as SearchResult)
      } catch {
        // palette stays usable with nav matches only
      }
    }, 200)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, open])

  const nav = matchesNav(items, query)
  const flat: Array<{ href: string; title: string; subtitle: string; group: string }> = [
    ...nav.map((n) => ({ href: n.href, title: n.label, subtitle: 'Trang', group: 'Điều hướng' })),
    ...result.orders.map((r) => ({ ...r, group: 'Đơn hàng' })),
    ...result.products.map((r) => ({ ...r, group: 'Sản phẩm' })),
    ...result.customers.map((r) => ({ ...r, group: 'Khách hàng' })),
  ]

  const go = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [close, router],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm admin"
        className="w-full max-w-lg overflow-hidden rounded-(--radius-lg) border border-border bg-surface-raised shadow-(--shadow-md)"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const value = e.target.value
            setQuery(value)
            setActive(0)
            if (value.trim().length < 2) setResult(EMPTY)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, flat.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && flat[active]) {
              go(flat[active].href)
            }
          }}
          placeholder="Tìm đơn, sản phẩm, khách hàng, trang… (/, ⌘K)"
          aria-label="Tìm kiếm admin"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-(length:--text-sm) text-fg outline-none placeholder:text-fg-subtle"
        />
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Kết quả">
          {flat.length === 0 ? (
            <li className="px-3 py-6 text-center text-(length:--text-sm) text-fg-muted">
              {query.trim().length < 2 ? 'Gõ ít nhất 2 ký tự để tìm.' : 'Không có kết quả.'}
            </li>
          ) : (
            flat.map((row, i) => (
              <li key={`${row.group}-${row.href}`}>
                <Link
                  href={row.href}
                  onClick={close}
                  onMouseEnter={() => setActive(i)}
                  role="option"
                  aria-selected={i === active}
                  className={`flex items-center gap-3 rounded-(--radius-md) px-3 py-2 text-(length:--text-sm) ${
                    i === active ? 'bg-brand-soft text-fg' : 'text-fg'
                  }`}
                >
                  <span className="w-20 shrink-0 text-(length:--text-xs) text-fg-subtle">
                    {row.group}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block truncate text-(length:--text-xs) text-fg-muted">
                      {row.subtitle}
                    </span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
