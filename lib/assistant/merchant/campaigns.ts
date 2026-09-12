/**
 * Campaign briefs (port of commerce-agents campaign flow, advisory stage).
 * TechStore has no campaign engine: the model drafts a brief, staff approve
 * it, and a human executes via coupons/flash offers. Approval is a status
 * flip only — it never touches catalog, pricing, or stock.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

export type CampaignMechanic = 'percent_off' | 'fixed_off' | 'bundle' | 'free_shipping' | 'flash_sale'
export type CampaignStatus = 'proposed' | 'approved' | 'rejected' | 'executed'

export interface CampaignBrief {
  id: string
  title: string
  mechanic: CampaignMechanic
  discount_pct: number | null
  starts_at: string | null
  ends_at: string | null
  rationale: string | null
  execution: string
  status: CampaignStatus
  created_at: string
}

const MECHANICS: CampaignMechanic[] = ['percent_off', 'fixed_off', 'bundle', 'free_shipping', 'flash_sale']

function toBrief(row: Record<string, unknown>): CampaignBrief {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    mechanic: MECHANICS.includes(row.mechanic as CampaignMechanic) ? (row.mechanic as CampaignMechanic) : 'percent_off',
    discount_pct: row.discount_pct == null ? null : Number(row.discount_pct),
    starts_at: row.starts_at == null ? null : String(row.starts_at),
    ends_at: row.ends_at == null ? null : String(row.ends_at),
    rationale: row.rationale == null ? null : String(row.rationale),
    execution: String(row.execution ?? ''),
    status: String(row.status ?? 'proposed') as CampaignStatus,
    created_at: String(row.created_at ?? ''),
  }
}

export interface DraftBriefInput {
  title: string
  mechanic: string
  discount_pct?: number
  starts_at?: string
  ends_at?: string
  rationale?: string
  execution: string
}

/** Guardrails: mechanic allowlist, discount cap 50%, coherent dates. */
export function validateBrief(input: DraftBriefInput): string | null {
  const title = input.title?.trim() ?? ''
  if (title.length < 4 || title.length > 120) return 'Tiêu đề 4–120 ký tự.'
  if (!MECHANICS.includes(input.mechanic as CampaignMechanic)) {
    return `mechanic phải một trong: ${MECHANICS.join(', ')}.`
  }
  if (input.discount_pct != null) {
    const pct = Number(input.discount_pct)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 50) return 'Giảm giá tối đa 50%.'
  }
  if (input.starts_at && input.ends_at && input.ends_at < input.starts_at) {
    return 'Ngày kết thúc phải sau ngày bắt đầu.'
  }
  const execution = input.execution?.trim() ?? ''
  if (execution.length < 4 || execution.length > 1000) return 'Hướng dẫn thực hiện 4–1000 ký tự.'
  return null
}

export async function draftCampaignBrief(
  input: DraftBriefInput,
  actorLabel: string | null,
): Promise<{ brief: CampaignBrief | null; error?: string }> {
  const invalid = validateBrief(input)
  if (invalid) return { brief: null, error: invalid }
  const { data, error } = await getSupabaseAdminClient()
    .from('campaign_briefs')
    .insert({
      title: input.title.trim(),
      mechanic: input.mechanic,
      discount_pct: input.discount_pct ?? null,
      starts_at: input.starts_at ?? null,
      ends_at: input.ends_at ?? null,
      rationale: input.rationale?.slice(0, 1000) ?? null,
      execution: input.execution.trim(),
      status: 'proposed',
      created_by_label: actorLabel?.slice(0, 120) ?? null,
    })
    .select('*')
    .single()
  if (error || !data || typeof data !== 'object') return { brief: null, error: 'Không lưu được brief.' }
  return { brief: toBrief(data as Record<string, unknown>) }
}

export async function listCampaignBriefs(status: CampaignStatus | 'all' = 'proposed'): Promise<CampaignBrief[]> {
  const query = getSupabaseAdminClient().from('campaign_briefs').select('*')
  const scoped = (status === 'all' ? query : query.eq('status', status)) as typeof query
  const { data, error } = await scoped.order('created_at', { ascending: false }).limit(20)
  if (error || !Array.isArray(data)) return []
  return (data as Record<string, unknown>[]).map(toBrief)
}

export async function decideCampaignBrief(
  id: string,
  decision: 'approve' | 'reject' | 'mark_executed',
  actorLabel: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const status: CampaignStatus =
    decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'executed'
  const { error } = await getSupabaseAdminClient()
    .from('campaign_briefs')
    .update({ status, decided_by_label: actorLabel?.slice(0, 120) ?? null, decided_at: new Date().toISOString() })
    .eq('id', id.slice(0, 80))
    .eq('status', decision === 'mark_executed' ? 'approved' : 'proposed')
  if (error) return { ok: false, error: 'Brief không tồn tại hoặc đã được xử lý.' }
  return { ok: true }
}
