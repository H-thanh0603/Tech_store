import { NextResponse } from 'next/server'

import { searchPolicies } from '@/lib/assistant/policies'

/**
 * Public read-only policy search for external AI agents (agent layer, see
 * docs/AGENT_LAYER.md). Only the store's own published policy passages are
 * returned — same grounding source the shopping assistant uses.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, 160) ?? ''
  if (q.length < 2) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'Cần truy vấn tối thiểu 2 ký tự.' },
      { status: 400 },
    )
  }

  const passages = searchPolicies(q, 3)
  return NextResponse.json({
    query: q,
    passages,
    note: 'Chỉ trả về chính sách TechStore đã công bố; trang đầy đủ: /return-policy, /terms, /privacy.',
  })
}
