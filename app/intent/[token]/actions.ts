'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { CART_COOKIE } from '@/lib/commerce/cookies'
import { createOpaqueToken, sha256Hex } from '@/lib/commerce/tokens'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getIntentByToken } from './intent'

/**
 * Human approval: load every intent item into a FRESH guest cart (stock is
 * re-checked live by cart_add_item — nothing was held at intent time), mark
 * the intent converted with an audit trail, then hand the human to the normal
 * /checkout where they — and only they — pay. Any item that fails keeps the
 * intent pending so the human can retry or decline.
 */
export async function approveIntent(token: string): Promise<void> {
  const intent = await getIntentByToken(token)
  if (!intent || intent.status !== 'pending') {
    redirect(`/intent/${token}?error=${encodeURIComponent('Intent không tồn tại hoặc đã hết hạn.')}`)
  }

  const supabase = getSupabaseAdminClient()
  // Guest cart writes go through the anon client like the human flow
  // (cart_* RPCs are granted to anon/authenticated only, not service_role).
  const cartClient = getSupabaseServerClient()
  const cartToken = createOpaqueToken()
  const failed: string[] = []
  for (const item of intent.items) {
    const { data } = await cartClient.rpc('cart_add_item', {
      p_cart_token_hash: await sha256Hex(cartToken),
      p_variant_id: item.variantId,
      p_quantity: item.quantity,
    })
    if (data?.code !== 'OK') failed.push(item.sku)
  }

  if (failed.length > 0) {
    redirect(
      `/intent/${token}?error=${encodeURIComponent(`Món hết hàng hoặc quá số lượng lúc này: ${failed.join(', ')}. Intent vẫn giữ — thử lại hoặc từ chối.`)}`,
    )
  }

  await supabase
    .from('agent_order_intents')
    .update({ status: 'converted', decided_at: new Date().toISOString() })
    .eq('id', intent.id)
  await supabase.from('admin_audit_logs').insert({
    action: 'agent_intent_converted',
    entity_type: 'agent_order_intent',
    entity_id: intent.id,
    payload: { agent: intent.agentName, items: intent.items.length },
    actor_label: 'human-approval',
  })

  const cookieStore = await cookies()
  cookieStore.set(CART_COOKIE, cartToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  revalidatePath('/cart')
  redirect('/checkout')
}

export async function declineIntent(token: string): Promise<void> {
  const intent = await getIntentByToken(token)
  if (intent && intent.status === 'pending') {
    const supabase = getSupabaseAdminClient()
    await supabase
      .from('agent_order_intents')
      .update({ status: 'declined', decided_at: new Date().toISOString() })
      .eq('id', intent.id)
    await supabase.from('admin_audit_logs').insert({
      action: 'agent_intent_declined',
      entity_type: 'agent_order_intent',
      entity_id: intent.id,
      payload: { agent: intent.agentName },
      actor_label: 'human-approval',
    })
  }
  revalidatePath(`/intent/${token}`)
}
