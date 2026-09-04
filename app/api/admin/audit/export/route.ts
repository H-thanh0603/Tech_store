import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/admin/auth'
import { canAccessModule } from '@/lib/admin/permissions'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

// CSV export of admin audit logs. Same filters as the audit page. Guarded by
// the admin session + reports module permission.

function csvCell(value: string): string {
  // Neutralize formula injection: prefix =, +, -, @, tab-carriage (SEC-009)
  let safe = value
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!canAccessModule(session.role, 'reports')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Throttle export: 10 / hour per admin (heavy RPC, prevent abuse)
  try {
    const { data: limited } = await getSupabaseAdminClient().rpc('check_rate_limit', {
      p_action: 'export_audit',
      p_identity: session.userId,
      p_limit: 10,
      p_window_minutes: 60,
    })
    if (limited === true) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
  } catch {
    // fail-open
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
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const rows = ((data as { rows?: unknown[] } | null)?.rows ?? []) as Array<{
    createdAt: string
    action: string
    entityType: string
    entityId: string | null
    actorLabel: string
    actorUserId: string | null
    payload: unknown
  }>

  const header = 'created_at,action,entity_type,entity_id,actor_label,actor_user_id,payload'
  const lines = rows.map((row) =>
    [
      row.createdAt,
      row.action,
      row.entityType,
      row.entityId ?? '',
      row.actorLabel,
      row.actorUserId ?? '',
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
