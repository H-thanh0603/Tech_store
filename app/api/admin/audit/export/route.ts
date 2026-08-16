import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/admin/supabase'
import { getAdminSession } from '@/lib/admin/auth'
import { canAccessModule } from '@/lib/admin/permissions'

// CSV export of admin audit logs. Same filters as the audit page. Guarded by
// the admin session + reports module permission.

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!canAccessModule(session.role, 'reports')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const entityType = url.searchParams.get('entity_type') || null
  const action = url.searchParams.get('action') || null
  const from = url.searchParams.get('from') || null
  const to = url.searchParams.get('to') || null

  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_audit_logs', {
    p_entity_type: entityType,
    p_action: action,
    p_from: from,
    p_to: to,
    p_limit: 500,
    p_offset: 0,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((data as { rows?: unknown[] } | null)?.rows ?? []) as Array<{
    createdAt: string
    action: string
    entityType: string
    entityId: string | null
    actorLabel: string
    payload: unknown
  }>

  const header = 'created_at,action,entity_type,entity_id,actor_label,payload'
  const lines = rows.map((row) =>
    [
      row.createdAt,
      row.action,
      row.entityType,
      row.entityId ?? '',
      row.actorLabel,
      JSON.stringify(row.payload ?? {}),
    ]
      .map((cell) => csvCell(String(cell)))
      .join(','),
  )
  const csv = [header, ...lines].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-logs.csv"',
    },
  })
}
