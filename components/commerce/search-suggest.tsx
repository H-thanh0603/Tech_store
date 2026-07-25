'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { track } from '@/lib/analytics'
import { formatPrice } from '@/lib/format'

type SuggestItem = {
  id: string
  slug: string
  name: string
  brandName: string | null
  minPrice: number
  imageUrl: string | null
  inStock: boolean
}

const POPULAR = ['laptop', 'iphone', 'samsung', 'tai nghe']

type SearchSuggestProps = {
  id?: string
  className?: string
  inputClassName?: string
  placeholder?: string
  compact?: boolean
  onNavigate?: () => void
}

export function SearchSuggest({
  id,
  className,
  inputClassName,
  placeholder = 'Tìm laptop, điện thoại, phụ kiện…',
  compact,
  onNavigate,
}: SearchSuggestProps) {
  const router = useRouter()
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SuggestItem[]>([])
  const [empty, setEmpty] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/catalog/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as {
          products: SuggestItem[]
          empty: boolean
        }
        setItems(data.products ?? [])
        setEmpty(Boolean(data.empty))
        setActiveIndex(-1)
        if (data.empty) track('search_no_result', { query: trimmed })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setItems([])
          setEmpty(true)
        }
      } finally {
        setLoading(false)
      }
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [trimmed])

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  function goSearch(q: string) {
    const term = q.trim()
    track('search_performed', { query: term || null, source: 'header' })
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : '/products')
    setOpen(false)
    onNavigate?.()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    goSearch(query)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    const total = items.length + (empty ? 0 : 0)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
      e.preventDefault()
      router.push(`/products/${items[activeIndex].slug}`)
      setOpen(false)
      onNavigate?.()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
    void total
  }

  const showPanel = open && (query.trim().length >= 1 || true)

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <form onSubmit={onSubmit} role="search">
        <label htmlFor={inputId} className="sr-only">
          Tìm sản phẩm
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" strokeLinecap="round" />
            </svg>
          </span>
          <input
            id={inputId}
            role="combobox"
            value={query}
            onChange={(e) => {
              const next = e.target.value
              setQuery(next)
              setOpen(true)
              if (next.trim().length < 2) {
                setItems([])
                setEmpty(false)
                setLoading(false)
                setActiveIndex(-1)
              }
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={
              inputClassName ??
              'min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary pl-10 pr-24 text-(length:--text-sm) text-fg shadow-(--shadow-sm) placeholder:text-fg-subtle focus-visible:border-brand'
            }
          />
          {!compact ? (
            <button
              type="submit"
              className="absolute inset-y-1 right-1 rounded-(--radius-sm) bg-brand px-3 text-(length:--text-sm) font-semibold text-accent-fg hover:bg-brand-hover"
            >
              Tìm
            </button>
          ) : null}
        </div>
      </form>

      {showPanel && open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-(--radius-lg) border border-border bg-bg-elevated p-2 shadow-(--shadow-lg)"
        >
          {query.trim().length < 2 ? (
            <div className="px-2 py-2">
              <p className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
                Gợi ý phổ biến
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {POPULAR.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      className="rounded-full bg-surface-muted px-3 py-1 text-(length:--text-xs) font-medium text-fg hover:bg-brand-soft hover:text-brand"
                      onClick={() => {
                        setQuery(term)
                        goSearch(term)
                      }}
                    >
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : loading ? (
            <p className="px-3 py-4 text-(length:--text-sm) text-fg-muted">Đang tìm…</p>
          ) : empty ? (
            <div className="px-3 py-4">
              <p className="text-(length:--text-sm) font-medium text-fg">Không có kết quả</p>
              <p className="mt-1 text-(length:--text-xs) text-fg-muted">
                Thử từ khóa khác hoặc xem catalog.
              </p>
              <button
                type="button"
                className="mt-3 text-(length:--text-sm) font-semibold text-brand"
                onClick={() => goSearch(query)}
              >
                Tìm “{query.trim()}” trong catalog →
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {items.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === activeIndex}>
                  <Link
                    href={`/products/${item.slug}`}
                    className={`flex items-center gap-3 rounded-(--radius-md) px-2 py-2 text-(length:--text-sm) ${
                      index === activeIndex ? 'bg-brand-soft' : 'hover:bg-surface-muted'
                    }`}
                    onClick={() => {
                      setOpen(false)
                      onNavigate?.()
                    }}
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-(--radius-sm) bg-surface-muted">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-medium text-fg">{item.name}</span>
                      <span className="block text-(length:--text-xs) text-fg-muted">
                        {item.brandName ?? 'TechStore'}
                        {!item.inStock ? ' · Hết hàng' : ''}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-fg">
                      {formatPrice(item.minPrice)}
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="mt-1 w-full rounded-(--radius-md) px-3 py-2 text-left text-(length:--text-sm) font-semibold text-brand hover:bg-surface-muted"
                  onClick={() => goSearch(query)}
                >
                  Xem tất cả kết quả cho “{query.trim()}” →
                </button>
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
