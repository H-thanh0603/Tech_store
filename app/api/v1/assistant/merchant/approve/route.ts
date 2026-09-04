import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdminSession } from '@/lib/admin/auth'
import { applySignedChange } from '@/lib/assistant/merchant/stage'
import type { StagedAction } from '@/lib/assistant/merchant/guardrails'

const actionSchema = z.object({
  kind: z.enum(['publish', 'price', 'stock']),
  target: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  mode: z.string().optional(),
  value: z.number().optional(),
  quantity: z.number().optional(),
})

const bodySchema = z.object({
  change: z.object({
    id: z.string(),
    kind: z.enum(['publish', 'price', 'stock']),
    summary: z.string(),
    note: z.string().nullable(),
    action: actionSchema,
    items: z.array(
      z.object({ productId: z.string(), name: z.string(), before: z.string(), after: z.string() }),
    ),
    createdAt: z.string(),
  }),
  signature: z.string().min(16),
})

/**
 * Apply an approved staged change. Requires the products module (the writes
 * touch listings/pricing/stock) on top of a verified staff session.
 * Re-verifies the envelope signature and guardrails against LIVE state, then
 * runs the existing product Server Action (audit included).
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession('products')
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Cần quyền sản phẩm.' }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Body phải là JSON.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Change không hợp lệ.' }, { status: 400 })
  }

  // Narrow the loose action shape to the exact staged union before executing.
  const { change, signature } = parsed.data
  const a = change.action
  const ids = Array.isArray(a.productIds) ? a.productIds.filter((v): v is string => typeof v === 'string') : []
  let action: StagedAction | null = null
  if (change.kind === 'publish' && (a.target === 'publish' || a.target === 'draft' || a.target === 'archive')) {
    action = { kind: 'publish', target: a.target, productIds: ids }
  } else if (
    change.kind === 'price' &&
    (a.mode === 'percent_up' || a.mode === 'percent_down' || a.mode === 'set_sale_off') &&
    (a.mode === 'set_sale_off' || typeof a.value === 'number')
  ) {
    action = { kind: 'price', productIds: ids, mode: a.mode, value: a.mode === 'set_sale_off' ? 0 : (a.value as number) }
  } else if (change.kind === 'stock' && typeof a.quantity === 'number') {
    action = { kind: 'stock', productIds: ids, quantity: a.quantity }
  }
  if (!action) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Loại change không hỗ trợ.' }, { status: 400 })
  }

  const result = await applySignedChange({
    change: { ...change, action },
    signature,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
