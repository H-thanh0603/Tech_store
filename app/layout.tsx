import type { Metadata } from 'next'

import { WebVitals } from '@/components/analytics/web-vitals'
import { buildRootMetadata } from '@/lib/app-metadata'

import './globals.css'

export const metadata: Metadata = buildRootMetadata()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col font-sans">
        {children}
        <WebVitals />
      </body>
    </html>
  )
}
