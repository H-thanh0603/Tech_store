import { NextResponse } from 'next/server'

import { requireAdminSession } from '@/lib/admin/auth'
import { listPendingStaged } from '@/lib/assistant/merchant/ledger'

/**
 * Pending staged changes for the approval column (survives refresh —
 * the ledger lives in assistant_staged_changes, not UI state).
 */
export async function GET() {
  try {
    await requireAdminSession('assistant')
  } catch (error) {
    const status = error instanceof Error && error.message === 'FORBIDDEN' ? 403 : 401
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Cần quyền trợ lý vận hành.' }, { status })
  }

  const pending = await listPendingStaged()
  return NextResponse.json({
    pending: pending.map((s) => ({
      changeId: s.change.id,
      kind: s.change.kind,
      summary: s.change.summary,
      note: s.change.note,
      items: s.change.items,
      createdAt: s.change.createdAt,
    })),
  })
}
