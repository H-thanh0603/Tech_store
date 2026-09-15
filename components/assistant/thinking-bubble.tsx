'use client'

import { useEffect, useState } from 'react'

const DEFAULT_STAGES = [
  'Đang tìm trong catalog TechStore…',
  'Đang so giá, tồn kho và khuyến mãi…',
  'Đang gói câu trả lời ngon nhất cho bạn…',
  'Hơi lâu một xíu — đang kiểm tra kỹ để không báo sai giá…',
] as const

const COMPARE_STAGES = [
  'Đang so giá, tồn kho và khuyến mãi…',
  'Đang xếp thông số từng món cạnh nhau…',
  'Đang cân nhắc đánh đổi để xếp thứ tự cho bạn…',
  'Hơi lâu một xíu — đang kiểm tra kỹ để không so sai…',
] as const

const LIST_STAGES = [
  'Đang lục catalog TechStore…',
  'Đang lọc theo nhu cầu và ngân sách của bạn…',
  'Đang chọn những món đáng xem nhất…',
  'Hơi lâu một xíu — đang kiểm tra còn hàng không đã…',
] as const

const ORDER_STAGES = [
  'Đang tra cứu đơn hàng…',
  'Đang đối chiếu mã đơn và số điện thoại…',
  'Đang soạn trạng thái mới nhất cho bạn…',
  'Hơi lâu một xíu — đang kiểm tra kỹ trạng thái…',
] as const

const POLICY_STAGES = [
  'Đang đọc chính sách cửa hàng…',
  'Đang đối chiếu điều khoản áp dụng…',
  'Đang tóm tắt phần bạn cần…',
  'Hơi lâu một xíu — đang đọc kỹ điều khoản…',
] as const

export type ShoppingIntent = 'default' | 'compare' | 'list' | 'order' | 'policy'

const INTENT_STAGES: Record<ShoppingIntent, readonly string[]> = {
  default: DEFAULT_STAGES,
  compare: COMPARE_STAGES,
  list: LIST_STAGES,
  order: ORDER_STAGES,
  policy: POLICY_STAGES,
}

/**
 * Keyword intent sniff for the thinking bubble only (presentation concern —
 * never gates a tool call). Conservative: anything ambiguous stays 'default'.
 */
export function detectIntent(text: string): ShoppingIntent {
  const lower = text.toLowerCase()
  if (/(tra cứu|theo dõi|đơn hàng|đơn của|track).*(đơn|mã)?|mã đơn/.test(lower)) return 'order'
  if (/(đổi trả|bảo hành|hoàn tiền|chính sách|thanh toán|giao hàng|vận chuyển|trả góp)/.test(lower)) {
    return 'policy'
  }
  if (/(so sánh|sosánh|compare|khác nhau|nên chọn|tốt hơn|đáng hơn)/.test(lower)) return 'compare'
  if (/(liệt kê|danh sách|có những|những gì|gợi ý.*(máy|laptop|điện thoại|phụ kiện)|tư vấn.*(máy|laptop|điện thoại)|mua gì|hàng gì|còn gì)/.test(lower)) {
    return 'list'
  }
  return 'default'
}

/** How long each stage shows before rotating to the next (last one sticks). */
const STAGE_MS = 4500

const MERCHANT_STAGES = [
  'Đang đọc số liệu vận hành…',
  'Đang đối chiếu tồn kho và đơn chờ xử lý…',
  'Đang soạn câu trả lời và change preview…',
  'Hơi lâu một xíu — đang kiểm tra kỹ số liệu…',
] as const

interface ThinkingBubbleProps {
  variant?: 'shopping' | 'merchant'
  /** Sniffed intent of the user's latest message; picks the stage copy. */
  intent?: ShoppingIntent
}

/**
 * Lively "AI is working" indicator for the dead zone before the first
 * streamed token: pulsing avatar, rotating honest-generic status lines,
 * and bouncing dots. Mount it when a turn starts, unmount when the first
 * content arrives — the timer resets on every mount.
 */
export function ThinkingBubble({ variant = 'shopping', intent = 'default' }: ThinkingBubbleProps) {
  const stages = variant === 'merchant' ? MERCHANT_STAGES : INTENT_STAGES[intent]
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (stage >= stages.length - 1) return
    const t = setTimeout(() => setStage((s) => Math.min(s + 1, stages.length - 1)), STAGE_MS)
    return () => clearTimeout(t)
  }, [stage, stages.length])

  return (
    <div className="flex items-start gap-2 self-start" role="status" aria-live="polite">
      <span
        aria-hidden="true"
        className="animate-pulse-soft grid size-7 shrink-0 place-items-center rounded-full bg-brand text-(length:--text-xs) text-accent-fg"
      >
        ✦
      </span>
      <div className="animate-fade-in max-w-72 rounded-(--radius-md) bg-surface-muted px-3 py-2">
        <p key={stage} className="animate-fade-in text-(length:--text-sm) text-fg">
          {stages[stage]}
        </p>
        <span aria-hidden="true" className="mt-1.5 flex gap-1">
          <span className="animate-typing-dot size-1.5 rounded-full bg-brand" />
          <span className="animate-typing-dot typing-dot-2 size-1.5 rounded-full bg-brand" />
          <span className="animate-typing-dot typing-dot-3 size-1.5 rounded-full bg-brand" />
        </span>
      </div>
    </div>
  )
}
