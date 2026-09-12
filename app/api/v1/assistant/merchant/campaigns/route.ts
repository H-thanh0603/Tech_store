import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdminSession } from '@/lib/admin/auth'
import { decideCampaignBrief, listCampaignBriefs } from '@/lib/assistant/merchant/campaigns'

const decideSchema = z.object({
  id: z.string().min(1).max(80),
  decision: z.enum(['approve', 'reject', 'mark_executed']),
})

/**
 * Campaign briefs surface. Advisory only: approve/reject/mark_executed flip
 * status — execution happens manually via coupons/flash offers.
 * Requires the assistant module (staff + MFA, like merchant chat).
 */
export async function GET() {
  try {
    await requireAdminSession('assistant')
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Cần quyền trợ lý.' }, { status })
  }
  return NextResponse.json({ briefs: await listCampaignBriefs('all') })
}

export async function POST(request: Request) {
  let session
  try {
    session = await requireAdminSession('assistant')
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Cần quyền trợ lý.' }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Body phải là JSON.' }, { status: 400 })
  }
  const parsed = decideSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Tham số không hợp lệ.' }, { status: 400 })
  }

  const result = await decideCampaignBrief(parsed.data.id, parsed.data.decision, session.userId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
