'use client'

import type { ReactNode } from 'react'

import { WelcomeModal } from '@/components/home/welcome-modal'
import { ToastProvider } from '@/components/ui/toast'

export function StorefrontProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <WelcomeModal />
    </ToastProvider>
  )
}
