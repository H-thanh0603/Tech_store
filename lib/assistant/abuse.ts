/**
 * Abuse ladder for the assistant endpoints: jailbreak attempts are logged to
 * security_events, and repeat offenders get a temporary row in abuse_bans
 * (checked at route entry → 403 while active).
 *
 * Escalation (jailbreak-class events in the trailing 24h):
 *   ≥3 → 1 hour ban · ≥6 → 24 hour ban.
 * Scope refusals never ban (too aggressive for curious users).
 * Fail-open everywhere: a logging/ban-infra outage must not break chat.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

const BAN_1H_THRESHOLD = 3
const BAN_24H_THRESHOLD = 6

export async function isBanned(identityHash: string): Promise<boolean> {
  try {
    const { data } = await getSupabaseAdminClient()
      .from('abuse_bans')
      .select('until')
      .eq('identity_hash', identityHash)
      .maybeSingle()
    return !!data && new Date(data.until).getTime() > Date.now()
  } catch {
    return false
  }
}

export async function recordViolation(
  identityHash: string,
  action: 'assistant_chat' | 'merchant_chat',
  kind: string,
  sample: string,
): Promise<void> {
  try {
    const db = getSupabaseAdminClient()
    await db.from('security_events').insert({
      action,
      identity_hash: identityHash,
      kind,
      sample: sample.slice(0, 500),
    })
    if (!kind.startsWith('jailbreak:') && kind !== 'fence-forgery' && kind !== 'system-exfil') return
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count } = await db
      .from('security_events')
      .select('id', { count: 'exact', head: true })
      .eq('identity_hash', identityHash)
      .gte('created_at', since)
      .in('kind', ['jailbreak:prompt-injection', 'jailbreak:system-exfil', 'fence-forgery', 'system-exfil'])
    const hits = count ?? 0
    if (hits >= BAN_24H_THRESHOLD) {
      await upsertBan(db, identityHash, 'repeated jailbreak attempts (24h)', 24)
    } else if (hits >= BAN_1H_THRESHOLD) {
      await upsertBan(db, identityHash, 'repeated jailbreak attempts (1h)', 1)
    }
  } catch {
    // Fail-open: logging must never break chat.
  }
}

type Db = ReturnType<typeof getSupabaseAdminClient>

async function upsertBan(db: Db, identityHash: string, reason: string, hours: number): Promise<void> {
  try {
    await db.from('abuse_bans').upsert(
      {
        identity_hash: identityHash,
        reason,
        until: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      },
      { onConflict: 'identity_hash' },
    )
  } catch {
    // Fail-open.
  }
}

export const ABUSE_BAN_MESSAGE =
  'Tài khoản/mạng của bạn tạm thời bị hạn chế dùng trợ lý do nhiều yêu cầu bất thường. Thử lại sau, hoặc liên hệ shop để được hỗ trợ.'
