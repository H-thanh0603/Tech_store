import { render as rtlRender } from '@testing-library/react'
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import React, { ReactElement } from 'react'
import { vi } from 'vitest'

export const mockRouter: AppRouterInstance = {
  back: vi.fn(),
  forward: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

export function render(ui: ReactElement, { router = mockRouter, ...options } = {}) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppRouterContext.Provider value={router}>
      {children}
    </AppRouterContext.Provider>
  )
  return rtlRender(ui, { wrapper: Wrapper, ...options })
}

export * from '@testing-library/react'
// Override render
export { render as customRender }
