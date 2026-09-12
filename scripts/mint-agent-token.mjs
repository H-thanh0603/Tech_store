// Mint a scoped bearer token for an external AI agent (docs/AGENT_LAYER.md).
// The plaintext token prints ONCE — store it in the agent's secret manager;
// only the SHA-256 lands in agent_tokens.
//
//   node scripts/mint-agent-token.mjs --name "chatgpt-shop" [--scopes cart:write]
//
// Env (or .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const KNOWN_SCOPES = ['cart:write']

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

const args = process.argv.slice(2)
const nameFlag = args.indexOf('--name')
const scopesFlag = args.indexOf('--scopes')
const name = nameFlag >= 0 ? args[nameFlag + 1] : undefined
const scopes = (scopesFlag >= 0 ? args[scopesFlag + 1] : 'cart:write').split(',').map((s) => s.trim())

if (!name) {
  console.error('Usage: node scripts/mint-agent-token.mjs --name "agent-name" [--scopes cart:write]')
  process.exit(1)
}
const unknown = scopes.filter((s) => !KNOWN_SCOPES.includes(s))
if (unknown.length > 0) {
  console.error(`Unknown scopes: ${unknown.join(', ')}. Known: ${KNOWN_SCOPES.join(', ')}`)
  process.exit(1)
}

const env = loadDotEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const plaintext = `tsa_${randomBytes(32).toString('base64url')}`
const hash = createHash('sha256').update(plaintext).digest('hex')

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
const { data, error } = await supabase
  .from('agent_tokens')
  .insert({ name, token_hash: hash, scopes })
  .select('id')
  .single()
if (error) {
  console.error(`mint failed: ${error.message}`)
  process.exit(1)
}

console.log(`Agent token minted (id ${data.id}). Plaintext below — it will never be shown again:`)
console.log(plaintext)
