// Seed a Supabase Auth user with an active admin_users row for local/E2E use.
// Idempotent: reuses the user if the email already exists.
//
//   node scripts/seed-admin-user.mjs
//
// Env (or .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ADMIN_E2E_EMAIL (default admin@techstore.local),
// ADMIN_E2E_PASSWORD (default techstore-admin-e2e).

import { createHmac } from 'node:crypto'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'

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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !serviceKey || !anonKey) {
  console.error('Missing Supabase URL, anon key, or service role key')
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

const { data: factorData, error: factorListError } = await supabase.auth.admin.mfa.listFactors({
  userId: created.user.id,
})
if (factorListError) {
  console.error(`MFA factor list failed: ${factorListError.message}`)
  process.exit(1)
}
for (const factor of factorData.factors) {
  const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({
    userId: created.user.id,
    id: factor.id,
  })
  if (deleteError) {
    console.error(`MFA factor reset failed: ${deleteError.message}`)
    process.exit(1)
  }
}

const userClient = createClient(url, anonKey, { auth: { persistSession: false } })
const { error: signInError } = await userClient.auth.signInWithPassword({ email, password })
if (signInError) {
  console.error(`MFA seed sign-in failed: ${signInError.message}`)
  process.exit(1)
}
const { data: enrolled, error: enrollError } = await userClient.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'TechStore E2E',
  issuer: 'TechStore',
})
if (enrollError) {
  console.error(`MFA enrollment failed: ${enrollError.message}`)
  process.exit(1)
}

function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of secret.replace(/=+$/u, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  }
  const key = Buffer.from(bits.match(/.{8}/gu)?.map((byte) => Number.parseInt(byte, 2)) ?? [])
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return value.toString().padStart(6, '0')
}

const { error: verifyError } = await userClient.auth.mfa.challengeAndVerify({
  factorId: enrolled.id,
  code: totp(enrolled.totp.secret),
})
if (verifyError) {
  console.error(`MFA verification failed: ${verifyError.message}`)
  process.exit(1)
}
await userClient.auth.signOut()
writeFileSync('.admin-e2e-mfa-secret', enrolled.totp.secret, { mode: 0o600 })

console.log(`Admin ready with MFA: ${email} / ${password} (user ${created.user.id})`)
