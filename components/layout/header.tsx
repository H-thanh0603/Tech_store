'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

import { useListCounts } from '@/components/commerce/list-toggles'
import { MiniCart } from '@/components/commerce/mini-cart'
import { SearchSuggest } from '@/components/commerce/search-suggest'
import { BottomNav } from '@/components/layout/bottom-nav'
import { CommitmentBar } from '@/components/layout/commitment-bar'
import { MegaMenuBar } from '@/components/layout/mega-menu'
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer'
import { RegionSelect } from '@/components/layout/region-select'
import { IconCompare, IconHeart, IconMenu, IconReceipt, IconUser } from '@/components/ui/icons'
import type { CartData } from '@/lib/commerce/types'
import type { HeaderNavView, MenuLink } from '@/lib/content/nav-view'

/**
 * Storefront header — three tiers (DESIGN_CELLPHONES_INSPIRED.md §3).
 *
 *  1. Utility bar: retail commitments.
 *  2. Main bar: logo, search (the centre of gravity), region, order lookup,
 *     wishlist/compare, account, cart.
 *  3. Category bar: CMS-driven mega menu on desktop, drawer on mobile.
 *
 * Sticky with a compact state: past ~80px of scroll the vertical padding shrinks
 * instead of the header disappearing, so search stays one click away without the
 * layout jumping (the outer element keeps a fixed footprint in flow).
 *
 * Navigation data is passed in from the server layout; this component never
 * fetches, so the mega menu costs no extra client round-trip.
 */

const SCROLL_COMPACT_AT = 80

type HeaderProps = {
  children?: ReactNode
  cart: CartData
  nav: HeaderNavView
  userEmail?: string | null
  userName?: string | null
}

export function Header({ children, cart, nav, userEmail, userName }: HeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const { wishCount, compareCount } = useListCounts()
  const signedIn = Boolean(userEmail)
  const accountLabel = userName || userEmail?.split('@')[0] || 'Đăng nhập'

  useEffect(() => {
    function onScroll() {
      setCompact(window.scrollY > SCROLL_COMPACT_AT)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const searchCategories: MenuLink[] = nav.entries.map((entry) => ({
    label: entry.label,
    href: entry.href,
  }))

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg-elevated/97 backdrop-blur-md">
        <div className={compact ? 'hidden lg:block' : undefined}>
          <CommitmentBar />
        </div>

        <div
          className={`container-store flex items-center gap-3 transition-[padding] duration-(--duration-fast) ${
            compact ? 'py-2' : 'py-3'
          }`}
        >
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-(--radius-md) border border-border text-fg lg:hidden"
            aria-label="Mở menu danh mục"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <IconMenu />
          </button>

          <Link href="/" className="group inline-flex min-h-11 shrink-0 items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-(--radius-md) bg-navy-deep text-(length:--text-sm) font-bold tracking-tight text-fg-inverse transition-transform duration-(--duration-fast) group-hover:scale-[1.03]"
            >
              TS
            </span>
            <span className="text-(length:--text-lg) font-semibold tracking-tight text-fg">
              TechStore
            </span>
          </Link>

          <SearchSuggest
            className="ml-2 hidden min-w-0 flex-1 md:block lg:max-w-2xl"
            categories={searchCategories}
          />

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            {children}

            <RegionSelect className="hidden xl:flex" />

            <Link
              href="/track-order"
              className="hidden min-h-11 items-center gap-1.5 rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg lg:inline-flex"
            >
              <IconReceipt size={18} />
              <span className="hidden xl:inline">Tra cứu đơn</span>
            </Link>

            <Link
              href="/wishlist"
              className="relative hidden min-h-11 items-center gap-1 rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg sm:inline-flex"
              aria-label={`Wishlist${wishCount ? `, ${wishCount} sản phẩm` : ''}`}
            >
              <IconHeart size={18} />
              {wishCount > 0 ? <CountBadge value={wishCount} /> : null}
            </Link>

            <Link
              href="/compare"
              className="relative hidden min-h-11 items-center gap-1 rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg md:inline-flex"
              aria-label={`So sánh${compareCount ? `, ${compareCount} sản phẩm` : ''}`}
            >
              <IconCompare size={18} />
              {compareCount > 0 ? <CountBadge value={compareCount} /> : null}
            </Link>

            <Link
              href={signedIn ? '/account' : '/account/login'}
              className="hidden min-h-11 items-center gap-1.5 rounded-(--radius-md) px-2.5 text-(length:--text-sm) font-medium text-fg-muted hover:bg-surface-muted hover:text-fg sm:inline-flex"
              aria-label={signedIn ? `Tài khoản ${accountLabel}` : 'Đăng nhập'}
            >
              <IconUser size={18} />
              <span className="hidden max-w-24 truncate lg:inline">{accountLabel}</span>
            </Link>

            <MiniCart cart={cart} />
          </div>
        </div>

        {/* Mobile search lives on its own row: it is the primary entry point and
            must not compete with the logo for width. */}
        <div className="container-store pb-3 md:hidden">
          <SearchSuggest
            compact
            categories={searchCategories}
            inputClassName="min-h-11 w-full rounded-(--radius-md) border border-border bg-bg-primary pl-10 pr-9 text-(length:--text-sm) text-fg placeholder:text-fg-subtle focus-visible:border-brand"
          />
        </div>

        <MegaMenuBar entries={nav.entries} quickLinks={nav.quickLinks} />
      </header>

      <MobileNavDrawer
        open={drawerOpen}
        entries={nav.entries}
        quickLinks={nav.quickLinks}
        onClose={() => setDrawerOpen(false)}
      />

      <BottomNav />
    </>
  )
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex min-w-5 justify-center rounded-full bg-brand-soft px-1 text-(length:--text-xs) font-semibold tabular-nums text-brand">
      {value > 99 ? '99+' : value}
    </span>
  )
}
