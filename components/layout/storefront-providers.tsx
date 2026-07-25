'use client'

import type { ReactNode } from 'react'

import { ToastProvider } from '@/components/ui/toast'

/**
 * Client providers for the storefront shell.
 *
 * The first-visit welcome modal was removed in S1: it covered the whole viewport
 * ~900ms after load, which blocked the header, search and navigation — the very
 * things this milestone makes the primary entry points. Promotions belong in the
 * hero/campaign slots that content editors control, not in an interstitial.
 */
export function StorefrontProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
