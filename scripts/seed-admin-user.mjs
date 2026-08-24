// Seed a Supabase Auth user with an active admin_users row for local/E2E use.
// Idempotent: reuses the user if the email already exists.
//
//   node scripts/seed-admin-user.mjs
//
// Env (or .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ADMIN_E2E_EMAIL (default admin@techstore.local),
// ADMIN_E2E_PASSWORD (default techstore-admin-e2e).

import { readFileSync, existsSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

function loadDotEnv() {
  const env = { ...process.env }
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

const env = loadDotEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const email = env.ADMIN_E2E_EMAIL || 'admin@techstore.local'
const password = env.ADMIN_E2E_PASSWORD || 'techstore-admin-e2e'

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let { data: created, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  // Already exists → look it up instead.
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listError) {
    console.error(`createUser failed (${error.message}); listUsers failed: ${listError.message}`)
    process.exit(1)
  }
  created = { user: listed.users.find((u) => u.email === email) }
  if (!created.user) {
    console.error(`createUser failed (${error.message}) and no user with email ${email} found`)
    process.exit(1)
  }
}

const { error: upsertError } = await supabase.from('admin_users').upsert(
  { user_id: created.user.id, display_name: 'E2E Admin', role: 'admin', is_active: true },
  { onConflict: 'user_id' },
)
if (upsertError) {
  console.error(`admin_users upsert failed: ${upsertError.message}`)
  process.exit(1)
}

console.log(`Admin ready: ${email} / ${password} (user ${created.user.id})`)
