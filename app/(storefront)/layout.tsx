import type { ReactNode } from 'react'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { StorefrontProviders } from '@/components/layout/storefront-providers'
import { getCart } from '@/lib/commerce/queries'

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const cart = await getCart()

  return (
    <StorefrontProviders>
      <a
        href="#main-content"
        className="sr-only rounded-(--radius-md) bg-brand px-4 py-2 text-accent-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Bỏ qua đến nội dung chính
      </a>
      <Header cart={cart} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </StorefrontProviders>
  )
}
