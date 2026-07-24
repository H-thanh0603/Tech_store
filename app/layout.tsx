import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { appMetadata } from '@/lib/app-metadata'
import { getCartItemCount } from '@/lib/commerce/queries'

import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-jakarta',
})

export const metadata: Metadata = appMetadata

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cartCount = await getCartItemCount()

  return (
    <html lang="vi" className={jakarta.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only rounded-(--radius-md) bg-accent px-4 py-2 text-accent-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Bỏ qua đến nội dung chính
        </a>
        <Header cartCount={cartCount} />
        <main id="main-content" className="container-store flex-1 py-8 sm:py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
