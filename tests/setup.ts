import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest does not auto-unmount RTL renders between tests, so without this the
// jsdom document accumulates every render and role queries match across tests.
afterEach(() => {
  cleanup()
})
