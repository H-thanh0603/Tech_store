import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { getProductBySlug } from '@/lib/catalog/queries'
import { createOpaqueToken, sha256Hex } from '@/lib/commerce/tokens'
import { tokenErrorStatus, verifyAgentToken } from '@/lib/agents/tokens'
import { getSiteUrl } from '@/lib/site'

/**
 * Agent order intents (docs/AGENT_LAYER.md tasks 4-5): the ONLY write an
 * external AI agent may perform. `POST /api/agents/intents` with
 * `Authorization: Bearer tsa_…` (scope cart:write) stages items the agent
 * picked; a human opens the returned approval URL, reviews, and converts the
 * intent into their own cart — checkout and payment stay 100% human on the
 * website. Stock is NOT held at intent time; availability is re-checked live
 * when the human converts (documented in the response + approval page).
 */

const itemSchema = z.object({
  slug: z.string().min(1).max(160),
  sku: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
})
const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(10) })

export async function POST(request: Request) {
  const verified = await verifyAgentToken(request.headers.get('authorization'), 'cart:write')
  if (!verified.ok) {
    return NextResponse.json(
      { code: verified.error, message: 'Agent token thiếu hoặc không hợp lệ.' },
      { status: tokenErrorStatus(verified.error) },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Body phải là JSON.' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'items: mảng 1–10 món {slug, sku, quantity 1–99}.' },
      { status: 400 },
    )
  }

  try {
    const supabase = getSupabaseAdminClient()
    const resolved: Array<{
      slug: string
      sku: string
      name: string
      variantId: string
      price: number
      quantity: number
      inStock: boolean
    }> = []
    const unknown: Array<{ slug: string; sku: string }> = []

    for (const item of parsed.data.items) {
      const product = await getProductBySlug(item.slug)
      const variant = product?.variants.find((v) => v.sku === item.sku) ?? null
      if (!product || !variant) {
        unknown.push({ slug: item.slug, sku: item.sku })
        continue
      }
      resolved.push({
        slug: item.slug,
        sku: item.sku,
        name: product.name,
        variantId: variant.id,
        price: variant.salePrice ?? variant.regularPrice,
        quantity: item.quantity,
        inStock: variant.inStock,
      })
    }

    if (unknown.length > 0) {
      return NextResponse.json(
        {
          code: 'UNKNOWN_ITEMS',
          message: 'Một số món không tồn tại — intent không được tạo, hãy sửa và gửi lại.',
          unknown,
        },
        { status: 422 },
      )
    }

    const approveToken = createOpaqueToken()
    const { data, error } = await supabase
      .from('agent_order_intents')
      .insert({
        token_id: verified.token.id,
        items: resolved,
        approve_token_hash: await sha256Hex(approveToken),
      })
      .select('id, expires_at')
      .single()
    if (error || !data) {
      return NextResponse.json({ code: 'INTENT_ERROR', message: 'Không tạo được intent lúc này.' }, { status: 500 })
    }

    await supabase.from('admin_audit_logs').insert({
      action: 'agent_intent_created',
      entity_type: 'agent_order_intent',
      entity_id: data.id,
      payload: { token: verified.token.name, items: resolved.length },
      actor_label: `agent:${verified.token.name}`,
    })

    const base = getSiteUrl()
    return NextResponse.json(
      {
        intentId: data.id,
        approvalUrl: `${base}/intent/${approveToken}`,
        expiresAt: data.expires_at,
        items: resolved.map((r) => ({
          slug: r.slug,
          sku: r.sku,
          name: r.name,
          price: r.price,
          quantity: r.quantity,
          inStock: r.inStock,
        })),
        note: 'Tồn kho chưa giữ — kiểm tra lại lúc người duyệt chuyển vào giỏ. Chỉ người bấm duyệt + thanh toán trên website mới tạo đơn thật.',
      },
      { status: 201 },
    )
  } catch {
    return NextResponse.json({ code: 'INTENT_ERROR', message: 'Không tạo được intent lúc này.' }, { status: 500 })
  }
}
