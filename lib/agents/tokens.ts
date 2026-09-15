/**
 * Scoped bearer tokens for external AI agents (docs/AGENT_LAYER.md tasks 4-5).
 *
 * A token grants exactly one capability today: `cart:write` — stage an order
 * intent a human later approves on the website. Money never moves on token
 * authority alone. Tokens are minted out-of-band
 * (scripts/mint-agent-token.mjs), stored as HMAC-SHA256 (TOKEN_PEPPER) with
 * legacy SHA-256 dual-read, and verified here on every write call with a
 * per-token rate-limit bucket.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

export const AGENT_TOKEN_PREFIX = 'tsa_'
export const AGENT_INTENTS_LIMIT = 30
const WINDOW_MINUTES = 15

export interface AgentToken {
  id: string
  name: string
  scopes: string[]
}

export type TokenError = 'MISSING' | 'INVALID' | 'INACTIVE' | 'FORBIDDEN' | 'RATE_LIMITED'

function bearerToken(header: string | null): string | null {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null
  return value.startsWith(AGENT_TOKEN_PREFIX) ? value : null
}

async function sha256HexNode(value: string): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(value).digest('hex')
}

/** Peppered agent-token hash (HMAC-SHA256). Falls back to legacy SHA-256 when unset. */
async function hashAgentToken(raw: string): Promise<string> {
  const pepper = process.env.TOKEN_PEPPER
  if (!pepper) return sha256HexNode(raw)
  const { createHmac } = await import('node:crypto')
  return createHmac('sha256', pepper).update(raw).digest('hex')
}

/**
 * Dual-read lookup: peppered hash first, legacy SHA-256 second — lets prod
 * rotate TOKEN_PEPPER in without invalidating minted tsa_* tokens.
 */
async function findAgentToken(raw: string) {
  const supabase = getSupabaseAdminClient()
  const peppered = await hashAgentToken(raw)
  const { data, error } = await supabase
    .from('agent_tokens')
    .select('id, name, scopes, is_active')
    .eq('token_hash', peppered)
    .maybeSingle()
  if (!error && data) return data
  if (process.env.TOKEN_PEPPER) {
    const legacy = await sha256HexNode(raw)
    if (legacy !== peppered) {
      const retry = await supabase
        .from('agent_tokens')
        .select('id, name, scopes, is_active')
        .eq('token_hash', legacy)
        .maybeSingle()
      if (!retry.error && retry.data) return retry.data
    }
  }
  return null
}

/**
 * Verify a request's agent token for the given scope. Returns the token row
 * or a machine-readable error — routes map these to 401/403/429.
 * Fail-closed: any DB error is INVALID, never anonymous access.
 */
export async function verifyAgentToken(
  authHeader: string | null,
  scope: 'cart:write',
): Promise<{ ok: true; token: AgentToken } | { ok: false; error: TokenError }> {
  const raw = bearerToken(authHeader)
  if (!raw) return { ok: false, error: 'MISSING' }

  try {
    const data = await findAgentToken(raw)
    if (!data) return { ok: false, error: 'INVALID' }
    if (!data.is_active) return { ok: false, error: 'INACTIVE' }
    if (!data.scopes.includes(scope)) return { ok: false, error: 'FORBIDDEN' }

    const supabase = getSupabaseAdminClient()
    let limited: unknown
    try {
      const res = await supabase.rpc('check_rate_limit', {
        p_action: 'agents_intents',
        p_identity: data.id,
        p_limit: AGENT_INTENTS_LIMIT,
        p_window_minutes: WINDOW_MINUTES,
      })
      if (res.error) throw res.error
      limited = res.data
    } catch {
      // Fail-CLOSED (H1): money-adjacent write path — a limiter outage
      // blocks new intents rather than unthrottling agent writes.
      return { ok: false, error: 'RATE_LIMITED' }
    }
    if (limited === true) return { ok: false, error: 'RATE_LIMITED' }

    await supabase.from('agent_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
    return { ok: true, token: { id: data.id, name: data.name, scopes: data.scopes } }
  } catch {
    return { ok: false, error: 'INVALID' }
  }
}
export function tokenErrorStatus(error: TokenError): number {
  switch (error) {
    case 'MISSING':
    case 'INVALID':
    case 'INACTIVE':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'RATE_LIMITED':
      return 429
  }
}

/**
 * Optional identity for the public READ API. Reads stay public (the data is
 * the storefront catalog), but a valid agent token upgrades the caller from
 * an anonymous IP bucket to a per-agent bucket with a higher quota — and
 * every read becomes attributable in rate-limit rows. Never throws.
 */
export async function verifyAgentReadToken(authHeader: string | null): Promise<AgentToken | null> {
  const raw = bearerToken(authHeader)
  if (!raw) return null
  try {
    const data = await findAgentToken(raw)
    if (!data || !data.is_active) return null
    return { id: data.id, name: data.name, scopes: data.scopes }
  } catch {
    return null
  }
}
