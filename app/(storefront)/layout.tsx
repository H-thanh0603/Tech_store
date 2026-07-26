import type { ReactNode } from 'react'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { StorefrontProviders } from '@/components/layout/storefront-providers'
import { getCatalogFacets } from '@/lib/catalog/queries'
import { getCart } from '@/lib/commerce/queries'
import { buildHeaderNav, navigationFallback } from '@/lib/content/nav-view'
import { getMegaMenuHighlights, getNavigationTree } from '@/lib/content/queries'
import { createSupabaseAuthClient } from '@/lib/supabase/auth-server'

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  // One parallel batch per request. `getNavigationTree`, `getCatalogFacets` and
  // `getMegaMenuHighlights` are the only extra queries the header needs, and all
  // three are cached, so a page that also renders filters or the homepage does
  // not pay for any of them twice.
  const [cart, supabase, navigation, facets, highlights] = await Promise.all([
    getCart(),
    createSupabaseAuthClient(),
    getNavigationTree(),
    getCatalogFacets(),
    getMegaMenuHighlights(),
  ])
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // An empty `navigation_items` table (fresh DB, failed query) must not leave the
  // storefront without a menu.
  const nav = buildHeaderNav(
    navigation.length > 0 ? navigation : navigationFallback(),
    facets.brands,
    highlights,
  )

  return (
    <StorefrontProviders>
      <a
        href="#main-content"
        className="sr-only rounded-(--radius-md) bg-brand px-4 py-2 text-accent-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Bỏ qua đến nội dung chính
      </a>
      <Header
        cart={cart}
        nav={nav}
        userEmail={user?.email ?? null}
        userName={(user?.user_metadata?.full_name as string | undefined) ?? null}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {/* Clears the fixed mobile bottom navigation. */}
      <div className="pad-bottom-nav">
        <Footer />
      </div>
    </StorefrontProviders>
  )
}
