/**
 * Rate limits for the assistant chat endpoints (budget protection).
 * Reuses the generic `check_rate_limit` RPC + request_rate_limits table.
 * Fail-open: a limiter outage never breaks chat.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

export const SHOPPING_CHAT_LIMIT = 20
export const MERCHANT_CHAT_LIMIT = 60
const WINDOW_MINUTES = 15

export function clientIp(headerList: Pick<Headers, 'get'>, fallback?: string | null): string {
  return (
    headerList.get('x-real-ip')?.trim() ||
    headerList.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    fallback?.split(',').at(-1)?.trim() ||
    'unknown'
  )
}

/** True when the caller exceeded the budget — respond 429. */
export async function isChatRateLimited(
  action: 'assistant_chat' | 'merchant_chat',
  identity: string,
): Promise<boolean> {
  try {
    const { data: limited } = await getSupabaseAdminClient().rpc('check_rate_limit', {
      p_action: action,
      p_identity: identity,
      p_limit: action === 'assistant_chat' ? SHOPPING_CHAT_LIMIT : MERCHANT_CHAT_LIMIT,
      p_window_minutes: WINDOW_MINUTES,
    })
    return limited === true
  } catch {
    return false
  }
}
