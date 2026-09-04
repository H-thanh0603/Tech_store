/**
 * Persistence for merchant staged changes (assistant_staged_changes).
 * Service-role only — staff reach rows exclusively through the API routes,
 * which enforce session + signature + guardrails.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

import type { SignedChange, StagedAction, StagedChange, StagedKind } from './guardrails'

interface Row {
  id: string
  kind: string
  summary: string
  note: string | null
  action: unknown
  items: unknown
  signature: string
  status: string
  created_at: string
}

function toSigned(row: Row): SignedChange | null {
  if (
    (row.kind !== 'publish' && row.kind !== 'price' && row.kind !== 'stock') ||
    typeof row.summary !== 'string' ||
    typeof row.signature !== 'string' ||
    row.action === null ||
    typeof row.action !== 'object' ||
    !Array.isArray(row.items)
  ) {
    return null
  }
  const change: StagedChange = {
    id: row.id,
    kind: row.kind as StagedKind,
    summary: row.summary,
    note: typeof row.note === 'string' ? row.note : null,
    action: row.action as StagedAction,
    items: row.items as StagedChange['items'],
    createdAt: row.created_at,
  }
  return { change, signature: row.signature }
}

export async function recordStaged(signed: SignedChange, actorUserId: string | null): Promise<void> {
  const { error } = await getSupabaseAdminClient().from('assistant_staged_changes').insert({
    id: signed.change.id,
    kind: signed.change.kind,
    summary: signed.change.summary,
    note: signed.change.note,
    action: signed.change.action,
    items: signed.change.items,
    signature: signed.signature,
    status: 'staged',
    created_by: actorUserId,
  })
  if (error) throw new Error(`record staged change: ${error.message}`)
}

export async function listPendingStaged(limit = 20): Promise<SignedChange[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from('assistant_staged_changes')
    .select('id, kind, summary, note, action, items, signature, status, created_at')
    .eq('status', 'staged')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`list pending changes: ${error.message}`)
  const out: SignedChange[] = []
  for (const row of (data ?? []) as Row[]) {
    const signed = toSigned(row)
    if (signed) out.push(signed)
  }
  return out
}

export async function getStagedById(changeId: string): Promise<SignedChange | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from('assistant_staged_changes')
    .select('id, kind, summary, note, action, items, signature, status, created_at')
    .eq('id', changeId.slice(0, 80))
    .maybeSingle()
  if (error || !data) return null
  return toSigned(data as Row)
}

export async function markStagedDecided(
  changeId: string,
  status: 'applied' | 'discarded',
  actorUserId: string,
): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from('assistant_staged_changes')
    .update({ status, decided_at: new Date().toISOString(), decided_by: actorUserId })
    .eq('id', changeId)
    .eq('status', 'staged')
  if (error) throw new Error(`mark change ${status}: ${error.message}`)
}
