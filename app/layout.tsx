import type { Metadata } from 'next'

import { appMetadata } from '@/lib/app-metadata'

import './globals.css'

export const metadata: Metadata = appMetadata

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
