'use client'

import type { AgentCall } from '@/lib/assistant/activity'

/**
 * Real-time Agent Activity UI (điểm 6): checklist các bước agent đang làm,
 * fed trực tiếp bởi sự kiện `activity` trên SSE stream. Hiển thị tối đa 6
 * bước gần nhất; mỗi bước là tool call đã chuẩn hóa (không lộ tool params).
 */
export function AgentActivityList({ calls }: { calls: AgentCall[] }) {
  const recent = calls.slice(-6)
  if (recent.length === 0) return null
  return (
    <div
      aria-label="Các bước trợ lý đang làm"
      className="mt-1 flex max-w-72 flex-col gap-1 rounded-(--radius-md) border border-border bg-bg-elevated px-2.5 py-2"
    >
      {recent.map((call, i) => (
        <div key={`${call.tool}-${i}`} className="flex items-center gap-1.5 text-(length:--text-xs) text-fg-muted">
          <span className="shrink-0 text-success" aria-hidden>
            ✓
          </span>
          <span className="min-w-0 truncate">
            {call.label}
            {call.detail ? <span className="text-fg-muted/80">: {call.detail}</span> : null}
          </span>
        </div>
      ))}
    </div>
  )
}
