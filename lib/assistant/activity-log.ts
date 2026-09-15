/**
 * AI Activity Log (điểm 5 — audit mọi tool call của agent). Append-only vào
 * bảng `agent_activity_log`: ai gọi, gọi gì, tham gia cuộc trò chuyện nào,
 * bối cảnh nào. Fail-open như abuse.ts — log lỗi không được phá chat.
 */

import { getSupabaseAdminClient } from '@/lib/admin/supabase'

import type { AgentCall } from './activity'

export type AgentName = 'shopping' | 'merchant'

interface ActivityDb {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>
  }
}

/** Ghi 1 tool call. Never throws — audit không được phá chat. */
export async function logAgentActivity(
  agent: AgentName,
  sessionKey: string,
  identityHash: string,
  call: AgentCall,
): Promise<void> {
  try {
    const db = getSupabaseAdminClient() as unknown as ActivityDb
    await db.from('agent_activity_log').insert({
      agent,
      session_key: sessionKey.slice(0, 200),
      tool: call.tool,
      kind: call.kind,
      detail: (call.detail ?? '').slice(0, 500),
      identity_hash: identityHash,
    })
  } catch {
    // Fail-open: logging must never break chat.
  }
}
