import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.claude/**',
    'supabase/.temp/**',
  ]),
  {
    files: [
      'app/(storefront)/**/*.{ts,tsx}',
      'components/commerce/**/*.{ts,tsx}',
      'components/layout/**/*.{ts,tsx}',
      'components/home/**/*.{ts,tsx}',
      'components/ui/**/*.{ts,tsx}',
      'lib/catalog/**/*.{ts,tsx}',
      'lib/content/**/*.{ts,tsx}',
      'lib/customer/**/*.{ts,tsx}',
      'lib/commerce/validation.ts',
      'lib/commerce/types.ts',
      'lib/commerce/money.ts',
    ],
    rules: {
      // Domain boundary: storefront (public) must never pull admin kernel
      // (service_role client, staff guards). Server commerce may use the
      // admin client in route handlers — that is intentional.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/admin*'],
              message:
                'Storefront code must not import @/lib/admin/* (service_role / staff-only). Use @/lib/catalog|commerce|content|supabase instead. See docs/ARCHITECTURE.md.',
            },
          ],
        },
      ],
    },
  },
])
