'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import { IconClose, IconSearch } from '@/components/ui/icons'
import { track } from '@/lib/analytics'
import type { MenuLink } from '@/lib/content/nav-view'
import {
  clearRecentSearches,
  getRecentSearches,
  getServerRecentSearches,
  pushRecentSearch,
  subscribeRecentSearches,
} from '@/lib/customer/recent-searches'
import { subscribeOpenSearch } from '@/lib/customer/search-events'
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

/** Curated entry points, not fabricated "trending" data. */
const POPULAR = ['laptop', 'iphone', 'samsung', 'tai nghe', 'bàn phím'] as const

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 220

type SearchSuggestProps = {
  id?: string
  className?: string
  inputClassName?: string
  placeholder?: string
  /** Hides the submit button (used inside the mobile header row). */
  compact?: boolean
  onNavigate?: () => void
  /** Category shortcuts shown before the user types; comes from the CMS nav. */
  categories?: MenuLink[]
}

/**
 * Header search: combobox + suggestion overlay.
 *
 * Overlay content follows DESIGN_CELLPHONES_INSPIRED.md §3.3 — recent searches,
 * popular keywords, category shortcuts, live product results, and an explicit
 * empty state. Recent searches live in localStorage only.
 *
 * Accessibility: the input is the combobox and `aria-controls` points at the
 * results listbox. Only product results are `option`s; chips and shortcuts stay
 * outside the listbox so the widget never announces a wrong option count.
 * Keyboard: ArrowUp/ArrowDown move through results, Enter opens the active one,
 * Escape closes without navigating.
 */
export function SearchSuggest({
  id,
  className,
  inputClassName,
  placeholder = 'Bạn cần tìm gì? Laptop, điện thoại, phụ kiện…',
  compact,
  onNavigate,
  categories = [],
}: SearchSuggestProps) {
  const router = useRouter()
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-results`
  const panelId = `${inputId}-panel`
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SuggestItem[]>([])
  const [empty, setEmpty] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const recent = useSyncExternalStore(
    subscribeRecentSearches,
    getRecentSearches,
    getServerRecentSearches,
  )

  const trimmed = query.trim()
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (!isSearching) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/catalog/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { products: SuggestItem[]; empty: boolean }
        setItems(data.products ?? [])
        setEmpty(Boolean(data.empty))
        setActiveIndex(-1)
        if (data.empty) {
          track('search_no_result', { query: trimmed })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setItems([])
          setEmpty(true)
        }
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [trimmed, isSearching])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Lets the mobile bottom navigation focus this field. Only the instance that
  // is actually visible reacts, so the desktop and mobile copies never fight.
  useEffect(
    () =>
      subscribeOpenSearch(() => {
        const input = inputRef.current
        if (!input || input.offsetParent === null) {
          return
        }
        window.scrollTo({ top: 0, behavior: 'auto' })
        input.focus()
        setOpen(true)
      }),
    [],
  )

  function goSearch(term: string) {
    const value = term.trim()
    if (value) {
      pushRecentSearch(value)
    }
    track('search_performed', { query: value || null, source: 'header' })
    router.push(value ? `/products?q=${encodeURIComponent(value)}` : '/products')
    setOpen(false)
    onNavigate?.()
  }

  function goProduct(item: SuggestItem) {
    pushRecentSearch(item.name)
    router.push(`/products/${item.slug}`)
    setOpen(false)
    onNavigate?.()
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    goSearch(query)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || items.length === 0) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      const item = items[activeIndex]
      if (item) {
        event.preventDefault()
        goProduct(item)
      }
    }
  }

  const activeOptionId = activeIndex >= 0 && items[activeIndex] ? `${listId}-${activeIndex}` : undefined

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
            <IconSearch size={18} />
          </span>
          <input
            id={inputId}
            ref={inputRef}
            role="combobox"
            value={query}
            onChange={(event) => {
              const next = event.target.value
              setQuery(next)
              setOpen(true)
              if (next.trim().length < MIN_QUERY_LENGTH) {
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
            aria-activedescendant={activeOptionId}
            className={
              inputClassName ??
              'min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary pl-10 pr-24 text-(length:--text-sm) text-fg shadow-(--shadow-sm) placeholder:text-fg-subtle focus-visible:border-brand'
            }
          />
          {query ? (
            <button
              type="button"
              aria-label="Xóa từ khóa"
              onClick={() => {
                setQuery('')
                setItems([])
                setEmpty(false)
                inputRef.current?.focus()
              }}
              className={`absolute inset-y-0 ${compact ? 'right-2' : 'right-20'} inline-flex items-center px-1 text-fg-subtle hover:text-fg`}
            >
              <IconClose size={16} />
            </button>
          ) : null}
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

      {open ? (
        <div
          id={panelId}
          className="animate-fade-in absolute left-0 right-0 z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-(--radius-lg) border border-border bg-bg-elevated p-2 shadow-(--shadow-lg)"
        >
          {!isSearching ? (
            <div className="flex flex-col gap-3 px-1 py-1">
              {recent.length > 0 ? (
                <section aria-label="Tìm kiếm gần đây">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
                      Tìm kiếm gần đây
                    </p>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-(length:--text-xs) font-medium text-fg-muted hover:text-brand"
                    >
                      Xóa
                    </button>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {recent.map((term) => (
                      <li key={`recent-${term}`}>
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-(length:--text-xs) font-medium text-fg-muted hover:border-brand hover:text-brand"
                          onClick={() => {
                            setQuery(term)
                            goSearch(term)
                          }}
                        >
                          <IconSearch size={13} />
                          {term}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-label="Từ khóa phổ biến">
                <p className="px-1 text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
                  Từ khóa phổ biến
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {POPULAR.map((term) => (
                    <li key={term}>
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center rounded-full bg-surface-muted px-3 text-(length:--text-xs) font-medium text-fg hover:bg-brand-soft hover:text-brand"
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
              </section>

              {categories.length > 0 ? (
                <section aria-label="Danh mục gợi ý">
                  <p className="px-1 text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-subtle">
                    Danh mục
                  </p>
                  <ul className="mt-1 flex flex-col">
                    {categories.slice(0, 6).map((category) => (
                      <li key={`cat-${category.href}`}>
                        <Link
                          href={category.href}
                          onClick={() => {
                            setOpen(false)
                            onNavigate?.()
                          }}
                          className="flex min-h-10 items-center justify-between rounded-(--radius-md) px-2 text-(length:--text-sm) text-fg-muted hover:bg-surface-muted hover:text-fg"
                        >
                          {category.label}
                          <span aria-hidden className="text-fg-subtle">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : loading ? (
            <p className="px-3 py-4 text-(length:--text-sm) text-fg-muted" role="status">
              Đang tìm…
            </p>
          ) : empty ? (
            <div className="px-3 py-4">
              <p className="text-(length:--text-sm) font-medium text-fg">Không có kết quả</p>
              <p className="mt-1 text-(length:--text-xs) text-fg-muted">
                Thử từ khóa ngắn hơn, hoặc xem toàn bộ catalog.
              </p>
              <button
                type="button"
                className="mt-3 text-(length:--text-sm) font-semibold text-brand"
                onClick={() => goSearch(trimmed)}
              >
                Tìm “{trimmed}” trong catalog →
              </button>
            </div>
          ) : null}

          {/* The listbox always exists so `aria-controls` never dangles. */}
          <ul id={listId} role="listbox" aria-label="Sản phẩm gợi ý" className="flex flex-col gap-0.5">
            {isSearching && !loading
              ? items.map((item, index) => (
                  <li
                    key={item.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <Link
                      href={`/products/${item.slug}`}
                      className={`flex items-center gap-3 rounded-(--radius-md) px-2 py-2 text-(length:--text-sm) ${
                        index === activeIndex ? 'bg-brand-soft' : 'hover:bg-surface-muted'
                      }`}
                      onClick={() => {
                        pushRecentSearch(item.name)
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
                      <span className="shrink-0 font-semibold tabular-nums text-fg">
                        {formatPrice(item.minPrice)}
                      </span>
                    </Link>
                  </li>
                ))
              : null}
          </ul>

          {isSearching && !loading && items.length > 0 ? (
            <button
              type="button"
              className="mt-1 w-full rounded-(--radius-md) px-3 py-2 text-left text-(length:--text-sm) font-semibold text-brand hover:bg-surface-muted"
              onClick={() => goSearch(trimmed)}
            >
              Xem tất cả kết quả cho “{trimmed}” →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
