import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdminSession } from '@/lib/admin/auth'
import { getStagedById, getStagedDecisionMeta, markStagedDecided } from '@/lib/assistant/merchant/ledger'
import { applySignedChange } from '@/lib/assistant/merchant/stage'

const bodySchema = z.object({
  changeId: z.string().min(1).max(80),
  decision: z.enum(['apply', 'discard']),
})

/**
 * Decide a staged change by id. The change payload lives in
 * assistant_staged_changes — the client only sends the id, so there is no
 * tamper surface in the request body.
 *
 * - apply: verify signature → re-check guardrails on LIVE state → execute the
 *   existing product Server Action (audit included) → mark applied.
 * - discard: mark discarded, no execution.
 * Requires the products module (writes touch listings/pricing/stock).
 */
export async function POST(request: Request) {
  let session
  try {
    session = await requireAdminSession('products')
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
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Tham số không hợp lệ.' }, { status: 400 })
  }

  const signed = await getStagedById(parsed.data.changeId)
  if (!signed) {
    return NextResponse.json(
      { ok: false, code: 'NOT_FOUND', message: 'Change không tồn tại hoặc đã được xử lý.' },
      { status: 404 },
    )
  }

  // Approval gates: expiry + separation of duties. A staged change lives 24h;
  // the staffer who staged it cannot approve it themselves (4-eyes principle).
  // H5: a null-actor row (staged without a bound staff id) is NEVER approvable —
  // SoD cannot be evaluated without a known stager, so reject and force re-stage.
  const meta = await getStagedDecisionMeta(parsed.data.changeId)
  if (meta?.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
    await markStagedDecided(signed.change.id, 'discarded', session.userId)
    return NextResponse.json(
      { ok: false, code: 'EXPIRED', message: 'Change đã hết hạn (24h) và bị hủy — hãy stage lại.' },
      { status: 410 },
    )
  }

  if (parsed.data.decision === 'discard') {
    await markStagedDecided(signed.change.id, 'discarded', session.userId)
    return NextResponse.json({ ok: true, message: 'Đã bỏ change.' })
  }

  if (!meta?.createdBy) {
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN_ACTOR', message: 'Change thiếu người stage — không thể duyệt, hãy stage lại.' },
      { status: 403 },
    )
  }
  if (meta.createdBy === session.userId) {
    return NextResponse.json(
      { ok: false, code: 'SELF_APPROVAL', message: 'Người stage không được tự duyệt — cần một staff khác.' },
      { status: 403 },
    )
  }

  const result = await applySignedChange(signed)
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 422 })
  }
  await markStagedDecided(signed.change.id, 'applied', session.userId)
  return NextResponse.json({ ok: true, message: result.message })
}
