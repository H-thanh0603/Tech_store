import type { Metadata } from 'next'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { appMetadata } from '@/lib/app-metadata'
import { getCartItemCount } from '@/lib/commerce/queries'

import './globals.css'

export const metadata: Metadata = appMetadata

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cartCount = await getCartItemCount()

  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only rounded-(--radius-md) bg-accent px-4 py-2 text-accent-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Bỏ qua đến nội dung chính
        </a>
        <Header cartCount={cartCount} />
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
