import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync('.env.local')) {
  loadEnvFile('.env.local')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync('.env.production.local')) {
  loadEnvFile('.env.production.local')
}

const required = [
  {
    resource: 'homepage_collections',
    select: 'filters',
    description: 'homepage collection filters',
  },
  {
    resource: 'public_product_reviews',
    select: 'id,product_id,author_name,rating,title,body,created_at',
    description: 'safe public review projection',
  },
]

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!baseUrl || !anonKey) {
  console.error('Schema contract check failed: missing Supabase URL or anon key')
  process.exit(1)
}

for (const check of required) {
  const url = new URL(`/rest/v1/${check.resource}`, `${baseUrl}/`)
  url.searchParams.set('select', check.select)
  url.searchParams.set('limit', '0')

  let response
  try {
    response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    })
  } catch {
    console.error(`Schema contract check failed for ${check.description}: endpoint unavailable`)
    process.exit(1)
  }

  if (!response.ok) {
    console.error(`Schema contract check failed for ${check.description} (HTTP ${response.status})`)
    process.exit(1)
  }
}

console.log('Schema contract check passed')
