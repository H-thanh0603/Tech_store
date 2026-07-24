import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/.next/**', '.claude/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
