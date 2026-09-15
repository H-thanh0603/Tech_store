import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { hashToken } from '@/lib/commerce/tokens'

export interface IntentItem {
  slug: string
  sku: string
  name: string
  variantId: string
  price: number
  quantity: number
  inStock: boolean
}

export interface OrderIntent {
  id: string
  items: IntentItem[]
  status: 'pending' | 'converted' | 'declined' | 'expired'
  expiresAt: string
  agentName: string
}

/**
 * Human-side intent lookup by the opaque approval token from the agent's
 * approvalUrl. Expired pendings are lazily flipped to expired so the UI and
 * the approve action agree. Returns null when the token is unknown.
 */
export async function getIntentByToken(token: string): Promise<OrderIntent | null> {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('agent_order_intents')
    .select('id, items, status, expires_at, token_id, agent_tokens!inner(name)')
    .eq('approve_token_hash', await hashToken(token))
    .maybeSingle()
  if (!data) return null

  if (data.status === 'pending' && new Date(data.expires_at).getTime() < Date.now()) {
    await supabase.from('agent_order_intents').update({ status: 'expired', decided_at: new Date().toISOString() }).eq('id', data.id)
    return {
      id: data.id,
      items: data.items as IntentItem[],
      status: 'expired',
      expiresAt: data.expires_at,
      agentName: (data.agent_tokens as unknown as { name: string }).name,
    }
  }

  return {
    id: data.id,
    items: data.items as IntentItem[],
    status: data.status as OrderIntent['status'],
    expiresAt: data.expires_at,
    agentName: (data.agent_tokens as unknown as { name: string }).name,
  }
}
