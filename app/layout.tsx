import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'

import { buildRootMetadata } from '@/lib/app-metadata'

import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-jakarta',
})

export const metadata: Metadata = buildRootMetadata()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={jakarta.variable}>
      <body className="flex min-h-screen flex-col font-sans">{children}</body>
    </html>
  )
}
