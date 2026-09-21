'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'

import { formatPrice } from '@/lib/format'
import type { AgentCall } from '@/lib/assistant/activity'
import { readChatStream } from '@/lib/assistant/sse'

import { detectIntent, ThinkingBubble, type ShoppingIntent } from './thinking-bubble'
import { AgentActivityList } from './agent-activity-list'

interface AssistantCard {
  product_id: string
  slug: string
  name: string
  brand: string | null
  price: number
  has_discount: boolean
  in_stock: boolean
  image: string | null
  url: string
}

interface CompareMatrix {
  rows: Array<{
    product_id: string
    slug: string
    name: string
    brand: string
    min_price: number
    has_discount: boolean
    in_stock: boolean
    key_specs: Array<{ label: string; value: string }>
    url: string
  }>
  summary: { cheapest: { slug: string; min_price: number } | null; inStock: string[] }
}

interface ShoppingPlan {
  title: string
  lines: Array<{
    product_id: string
    slug: string
    name: string
    unit_price: number
    quantity: number
    line_total: number
    url: string
  }>
  total: number
  budget: number | null
  overBudget: boolean
  rejected: Array<{ identifier: string; reason: string }>
}

interface OrderTracking {
  orderCode: string
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  total: number
  itemCount: number
  createdAt: string
}

interface FulfillmentInfo {
  delivery: {
    rate_name: string
    base_rate: number
    per_item_rate: number
    free_threshold: number
    quote: { fee: number; is_free: boolean } | null
  } | null
  pickup_stores: Array<{
    id: string
    name: string
    phone: string | null
    province: string
    district: string
    address: string
    opening_hours: string
  }>
  carriers: string[]
  note: string
}

interface ToolFilterInfo {
  source: string
  buckets: string[]
  sent: number
  full: number
}

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string
  cards?: AssistantCard[]
  suggestions?: string[]
  comparison?: CompareMatrix | null
  plan?: ShoppingPlan | null
  /** Order tracking result (track_order flow) — rendered inline. */
  tracking?: OrderTracking | null
  /** Fulfillment options (get_fulfillment_options flow) — rendered before checkout. */
  fulfillment?: FulfillmentInfo | null
  /** Current cart snapshot (item count + subtotal) for header chip. */
  cart?: { item_count: number; subtotal: number } | null
  /** Budget from memory for persistent budget chip. */
  budget_vnd?: number | null
  /** Detected intent of the user message that triggered this entry. */
  intent?: ShoppingIntent
  /** Real-time Agent Activity UI: tool calls streamed during this turn. */
  activity?: AgentCall[]
  /** JEV tool-filter measurement for this turn (which buckets, how many schemas). */
  toolFilter?: ToolFilterInfo | null
}

const HELLO: ChatEntry = {
  role: 'assistant',
  content:
    'Chào bạn, mình là trợ lý TechStore. Bạn cần tìm máy gì, ngân sách bao nhiêu — hoặc muốn tra cứu đơn hàng?',
  suggestions: [
    'Laptop nào pin trâu cho sinh viên, dưới 20 triệu?',
    'So sánh iPhone 15 và Galaxy S24 — nên chọn bên nào?',
    'Đang có deal nào hot không?',
    'Top máy bán chạy nhất tháng này',
  ],
}

async function postChat(
  messages: { role: string; content: string }[],
  onText: (delta: string) => void,
  onActivity: (call: AgentCall) => void,
) {
  const res = await fetch('/api/v1/assistant/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-10), stream: true, sessionId: assistantSessionId() }),
  })
  return readChatStream<{
    reply: string
    cards: AssistantCard[]
    suggestions: string[]
    comparison: CompareMatrix | null
    plan: ShoppingPlan | null
    tracking: OrderTracking | null
    fulfillment: FulfillmentInfo | null
    cart: { item_count: number; subtotal: number } | null
    budget_vnd: number | null
    /** Stream path uses camelCase; non-stream route returns snake_case. */
    toolFilter?: ToolFilterInfo | null
    tool_filter?: ToolFilterInfo | null
  }>(res, onText, onActivity)
}

/** Stable per-browser chat session id for memory (regenerated if missing). */
function assistantSessionId(): string {
  try {
    const key = 'ts_assistant_session'
    let id = window.localStorage.getItem(key)
    if (!id || id.length < 8) {
      id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
      window.localStorage.setItem(key, id)
    }
    return id
  } catch {
    return `fallback-${Date.now()}`
  }
}

interface ProductMiniCardProps {
  card: AssistantCard
  wide?: boolean
  onAddToCart?: (card: AssistantCard) => void
}

function ProductMiniCard({ card, wide = false, onAddToCart }: ProductMiniCardProps) {
  return (
    <div className={wide ? 'flex w-full shrink-0 gap-2' : 'flex w-40 shrink-0 flex-col'}>
      <Link
        href={card.url}
        className={
          wide
            ? 'flex w-full shrink-0 gap-2 overflow-hidden rounded-(--radius-md) border border-border bg-bg-elevated'
            : 'flex w-40 shrink-0 flex-col overflow-hidden rounded-(--radius-md) border border-border bg-bg-elevated'
        }
      >
        <div
          className={
            wide
              ? 'relative h-16 w-16 shrink-0 bg-bg-secondary/60'
              : 'relative aspect-[4/3] bg-bg-secondary/60'
          }
        >
          {card.image ? (
            <Image src={card.image} alt={card.name} fill sizes="160px" className="object-cover" />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2">
          <p className="line-clamp-2 text-(length:--text-xs) font-medium text-fg">{card.name}</p>
          <p className="text-(length:--text-xs) font-semibold text-brand">{formatPrice(card.price)}</p>
          <p className="text-(length:--text-xs) text-fg-muted">
            {card.in_stock ? 'Còn hàng' : 'Hết hàng'}
          </p>
        </div>
      </Link>
      {onAddToCart && card.in_stock && (
        <button
          type="button"
          onClick={() => onAddToCart(card)}
          className="mt-2 w-full rounded-(--radius-md) bg-brand px-3 py-1.5 text-(length:--text-xs) font-semibold text-accent-fg hover:bg-brand-hover"
        >
          Thêm vào giỏ
        </button>
      )}
    </div>
  )
}

/**
 * Horizontal card carousel: arrows on both sides page the strip. Scroll is
 * driven imperatively so the arrows work even without native smooth snapping.
 */
function CardCarousel({ cards, onAddToCart }: { cards: AssistantCard[]; onAddToCart: (card: AssistantCard) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)

  function page(direction: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * (track.clientWidth - 40), behavior: 'smooth' })
  }

  return (
    <div className="mt-2 flex max-w-72 items-center gap-1">
      <button
        type="button"
        onClick={() => page(-1)}
        aria-label="Xem sản phẩm trước"
        className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-bg-elevated text-(length:--text-xs) text-fg-muted hover:bg-surface-muted"
      >
        ‹
      </button>
      <div ref={trackRef} className="flex w-full gap-2 overflow-x-auto pb-1 [scroll-snap-type:x_mandatory]">
        {cards.map((card) => (
          <div key={card.product_id} className="[scroll-snap-align:start]">
            <ProductMiniCard card={card} onAddToCart={onAddToCart} />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => page(1)}
        aria-label="Xem sản phẩm tiếp theo"
        className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-bg-elevated text-(length:--text-xs) text-fg-muted hover:bg-surface-muted"
      >
        ›
      </button>
    </div>
  )
}

/** Vertical stack of wider product rows. */
function CardStack({ cards, onAddToCart }: { cards: AssistantCard[]; onAddToCart: (card: AssistantCard) => void }) {
  return (
    <div className="mt-2 flex max-w-72 flex-col gap-2">
      {cards.map((card) => (
        <ProductMiniCard key={card.product_id} card={card} wide onAddToCart={onAddToCart} />
      ))}
    </div>
  )
}

/** Spec labels worth their own rows in the compare matrix. */
function specRows(matrix: CompareMatrix): string[] {
  const seen: string[] = []
  for (const row of matrix.rows) {
    for (const spec of row.key_specs) {
      if (!seen.includes(spec.label)) seen.push(spec.label)
    }
  }
  return seen.slice(0, 6)
}

/**
 * Side-by-side compare matrix (1): the row data already exists server-side
 * (compareProducts) but used to die as model prose. Cheapest column gets a
 * badge; out-of-stock cells are dimmed.
 */
function CompareMatrixView({ matrix }: { matrix: CompareMatrix }) {
  const specs = specRows(matrix)
  const cheapest = matrix.summary.cheapest?.slug
  return (
    <div className="mt-2 max-w-72 overflow-x-auto rounded-(--radius-md) border border-border bg-bg-elevated">
      <table className="w-full min-w-64 text-left text-(length:--text-xs)">
        <thead>
          <tr className="border-b border-border">
            <th className="px-2 py-1.5 font-medium text-fg-muted" />
            {matrix.rows.map((row) => (
              <th key={row.slug} className="max-w-24 px-2 py-1.5 align-top">
                <Link href={row.url} className="line-clamp-2 font-semibold text-fg hover:text-brand">
                  {row.name}
                </Link>
                {row.slug === cheapest ? (
                  <span className="mt-0.5 inline-block rounded-full bg-brand/10 px-1.5 py-0.5 text-(length:--text-[10px]) font-bold text-brand">
                    Rẻ nhất
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="px-2 py-1.5 font-medium text-fg-muted">Giá</td>
            {matrix.rows.map((row) => (
              <td key={row.slug} className="px-2 py-1.5 font-semibold text-brand">
                {formatPrice(row.min_price)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-1.5 font-medium text-fg-muted">Tồn kho</td>
            {matrix.rows.map((row) => (
              <td key={row.slug} className={`px-2 py-1.5 ${row.in_stock ? '' : 'opacity-50'}`}>
                {row.in_stock ? 'Còn hàng' : 'Hết hàng'}
              </td>
            ))}
          </tr>
          {specs.map((label) => (
            <tr key={label} className="border-b border-border last:border-0">
              <td className="px-2 py-1.5 font-medium text-fg-muted">{label}</td>
              {matrix.rows.map((row) => (
                <td key={row.slug} className="max-w-24 truncate px-2 py-1.5" title={row.key_specs.find((s) => s.label === label)?.value ?? '—'}>
                  {row.key_specs.find((s) => s.label === label)?.value ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Interactive shopping plan (2): checklist with per-line qty, budget bar,
 * and one "add all" that posts a single chat command (human-confirm gate
 * still applies server-side).
 */
function ShoppingPlanView({ plan, onSend }: { plan: ShoppingPlan; onSend: (text: string) => void }) {
  const pct = plan.budget ? Math.min(100, Math.round((plan.total / plan.budget) * 100)) : null
  const addAll = `Thêm cả plan "${plan.title}" vào giỏ giúp mình`
  return (
    <div className="mt-2 max-w-72 rounded-(--radius-md) border border-border bg-bg-elevated p-2">
      <p className="text-(length:--text-xs) font-semibold text-fg">{plan.title}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {plan.lines.map((line) => (
          <li key={line.slug} className="flex items-center justify-between gap-2 text-(length:--text-xs)">
            <Link href={line.url} className="line-clamp-1 flex-1 text-fg hover:text-brand">
              {line.name} × {line.quantity}
            </Link>
            <span className="shrink-0 font-semibold text-brand">{formatPrice(line.line_total)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-(length:--text-xs)">
        <span className="font-medium text-fg-muted">Tổng</span>
        <span className="font-bold text-fg">{formatPrice(plan.total)}</span>
      </div>
      {plan.budget != null && pct != null ? (
        <div className="mt-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${plan.overBudget ? 'bg-danger' : 'bg-brand'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={`mt-0.5 text-(length:--text-[11px]) ${plan.overBudget ? 'font-semibold text-danger' : 'text-fg-muted'}`}>
            {plan.overBudget
              ? `Vượt ngân sách ${formatPrice(plan.budget)} — bỏ bớt 1 món nhé?`
              : `${pct}% ngân sách ${formatPrice(plan.budget)}`}
          </p>
        </div>
      ) : null}
      {plan.rejected.length > 0 ? (
        <p className="mt-1 text-(length:--text-[11px]) text-fg-muted">
          Bỏ qua {plan.rejected.length} món: {plan.rejected[0].reason}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => onSend(addAll)}
        className="mt-2 w-full rounded-(--radius-md) bg-brand px-3 py-1.5 text-(length:--text-xs) font-semibold text-accent-fg hover:bg-brand-hover"
      >
        Thêm cả plan vào giỏ
      </button>
    </div>
  )
}

/**
 * Order tracking inline view (4): timeline + next action.
 */
function OrderTrackingView({ tracking }: { tracking: OrderTracking }) {
  const statusLabels: Record<string, string> = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    packing: 'Đang đóng gói',
    shipping: 'Đang giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    expired: 'Hết hạn',
    return_requested: 'Yêu cầu trả hàng',
    returned: 'Đã trả hàng',
  }
  const paymentLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    expired: 'Hết hạn',
    refunded: 'Đã hoàn tiền',
  }
  return (
    <div className="mt-2 max-w-72 rounded-(--radius-md) border border-border bg-bg-elevated p-3">
      <p className="text-(length:--text-xs) font-semibold text-fg">Đơn {tracking.orderCode}</p>
      <div className="mt-1.5 flex items-center gap-2 text-(length:--text-xs)">
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-(length:--text-[10px]) font-medium text-brand">
          {statusLabels[tracking.orderStatus] ?? tracking.orderStatus}
        </span>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-(length:--text-[10px]) font-medium text-brand">
          {paymentLabels[tracking.paymentStatus] ?? tracking.paymentStatus}
        </span>
      </div>
      <p className="mt-1.5 text-(length:--text-xs) text-fg-muted">Tổng: {formatPrice(tracking.total)} · {tracking.itemCount} món</p>
    </div>
  )
}

/**
 * Fulfillment options inline view (7): delivery fee + pickup stores before checkout.
 */
function FulfillmentView({ fulfillment }: { fulfillment: FulfillmentInfo }) {
  const fee = fulfillment.delivery?.quote?.fee ?? 0
  const isFree = fulfillment.delivery?.quote?.is_free ?? false
  return (
    <div className="mt-2 max-w-72 rounded-(--radius-md) border border-border bg-bg-elevated p-3">
      <p className="text-(length:--text-xs) font-semibold text-fg">Tùy chọn giao nhận</p>
      {fulfillment.delivery ? (
        <div className="mt-1.5 space-y-1 text-(length:--text-xs)">
          <div className="flex justify-between">
            <span className="text-fg-muted">{fulfillment.delivery.rate_name}</span>
            <span className={`font-semibold ${isFree ? 'text-success' : 'text-brand'}`}>
              {isFree ? 'Miễn phí ship' : formatPrice(fee)}
            </span>
          </div>
          {fulfillment.delivery.free_threshold > 0 && (
            <p className="text-(length:--text-[11px]) text-fg-muted">
              Miễn phí ship từ {formatPrice(fulfillment.delivery.free_threshold)}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-(length:--text-xs) text-fg-muted">Chưa có phí ship chính xác — tính khi checkout.</p>
      )}
      {fulfillment.pickup_stores.length > 0 && (
        <div className="mt-2">
          <p className="text-(length:--text-xs) font-medium text-fg">Nhận tại cửa hàng ({fulfillment.pickup_stores.length})</p>
          <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
            {fulfillment.pickup_stores.slice(0, 3).map((store) => (
              <li key={store.id} className="text-(length:--text-xs) text-fg-muted truncate">
                {store.name} — {store.province}, {store.district}
              </li>
            ))}
            {fulfillment.pickup_stores.length > 3 && (
              <li className="text-(length:--text-[11px]) text-brand">+{fulfillment.pickup_stores.length - 3} cửa hàng khác</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Contextual follow-up chips (5): when the model sends no suggestions,
 * derive them from what the turn actually produced. */
function fallbackSuggestions(entry: ChatEntry): string[] {
  if (entry.tracking) return ['Đơn này khi nào giao tới?', 'Tôi muốn đổi ý / trả hàng', 'Xem đơn khác']
  if (entry.plan) return ['Chốt đơn này', 'Bỏ bớt 1 món cho vừa ngân sách', 'Xem phí ship']
  if (entry.comparison) return ['Lấy con rẻ nhất', 'So sánh thêm 1 con nữa', 'Xem chi tiết con ưng nhất']
  if (entry.fulfillment) return ['Chốt đơn, giao tận nơi', 'Tôi qua cửa hàng lấy', 'Xem giỏ hàng']
  if (entry.cart && entry.cart.item_count > 0) return ['Xem giỏ hàng', 'Phí ship bao nhiêu?', 'Chốt đơn']
  if (entry.cards && entry.cards.length > 0) return ['So sánh 2 con đầu', 'Con nào rẻ nhất?', 'Thêm con ưng nhất vào giỏ']
  return []
}

interface ReplySegment {
  kind: 'point' | 'text'
  text: string
  ordinal?: number
}

/** Pure parse: list-marker lines become numbered points, blanks dropped. */
function parseReplyLines(content: string): ReplySegment[] {
  let ordinal = 0
  const segments: ReplySegment[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const marker = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (marker) {
      ordinal += 1
      segments.push({ kind: 'point', text: marker[1], ordinal })
    } else {
      segments.push({ kind: 'text', text: trimmed })
    }
  }
  return segments
}

/**
 * Assistant reply with ordered-point rendering: lines starting with a list
 * marker get a 1-2-3 badge so comparison/list answers read as a ranking.
 */
function AssistantReply({ content }: { content: string }) {
  const segments = parseReplyLines(content)
  return (
    <div className="flex flex-col gap-1.5">
      {segments.map((seg, i) =>
        seg.kind === 'point' ? (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-brand text-(length:--text-[10px]) font-bold text-accent-fg">
              {seg.ordinal}
            </span>
            <span className="whitespace-pre-wrap">{seg.text}</span>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {seg.text}
          </p>
        ),
      )}
    </div>
  )
}

/**
 * JEV tool-filter badge: which buckets the turn used, from where, and how
 * many tool schemas the model actually saw (sent/full). Proves JEV ran.
 */
function JevBadge({ info }: { info: ToolFilterInfo }) {
  const sourceLabels: Record<string, string> = {
    keyword: 'từ khóa',
    history: 'kế thừa turn trước',
    jev: 'JEV chọn',
    full: 'full toolset',
  }
  const pct = info.full > 0 ? Math.round((info.sent / info.full) * 100) : 100
  return (
    <p
      className="mt-1.5 max-w-72 text-(length:--text-[11px]) text-fg-muted"
      title={`JEV tool-filter: ${info.source} → ${info.buckets.join(', ')} (${info.sent}/${info.full} schemas)`}
    >
      ⚡ JEV {sourceLabels[info.source] ?? info.source} · {info.buckets.join('+')} · {info.sent}/{info.full} tools ({pct}%)
    </p>
  )
}

/** Card display mode: horizontal arrows carousel or vertical stack. */
type CardLayout = 'horizontal' | 'vertical'

function ProductCards({ cards, entryIndex, onAddToCart }: { cards: AssistantCard[]; entryIndex: number; onAddToCart: (card: AssistantCard) => void }) {
  const [layout, setLayout] = useState<CardLayout>(() => (cards.length > 3 ? 'horizontal' : 'vertical'))
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setLayout((l) => (l === 'horizontal' ? 'vertical' : 'horizontal'))}
        aria-label={layout === 'horizontal' ? 'Hiển thị danh sách dọc' : 'Hiển thị ngang có nút chuyển'}
        title={layout === 'horizontal' ? 'Danh sách dọc' : 'Xem ngang'}
        className="absolute -top-1 right-0 z-10 grid size-6 place-items-center rounded-full border border-border bg-bg-elevated text-(length:--text-[10px]) text-fg-muted hover:bg-surface-muted"
      >
        {layout === 'horizontal' ? '☰' : '⇄'}
      </button>
      {layout === 'horizontal' ? (
        <CardCarousel key={`h-${entryIndex}`} cards={cards} onAddToCart={onAddToCart} />
      ) : (
        <CardStack key={`v-${entryIndex}`} cards={cards} onAddToCart={onAddToCart} />
      )}
    </div>
  )
}


export function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ChatEntry[]>([HELLO])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  async function send(text: string) {
    const clean = text.trim().slice(0, 1000)
    if (!clean || pending) return
    setDraft('')
    setFailed(false)
    const intent = detectIntent(clean)
    const next = [...entries, { role: 'user', content: clean } as ChatEntry]
    // Placeholder assistant entry streams deltas into place.
    setEntries([...next, { role: 'assistant', content: '', intent } as ChatEntry])
    setPending(true)
    // Real-time Agent Activity UI: checklist steps stream in as tools fire.
    const onActivity = (call: AgentCall) => {
      setEntries((prev) => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        if (last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, activity: [...(last.activity ?? []), call] }]
      })
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }
    const appendDelta = (delta: string) => {
      setEntries((prev) => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        if (last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
      })
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }
    try {
      const data = await postChat(
        next.map((e) => ({ role: e.role, content: e.content })),
        appendDelta,
        onActivity,
      )
      // Header cart badge: refresh without reload when the turn touched the cart.
      if (data.cart) {
        try {
          window.dispatchEvent(new Event('cart:updated'))
        } catch {
          // Non-browser render: ignore.
        }
      }
      setEntries((prev) => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        if (last.role !== 'assistant') return prev
        return [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: data.reply,
            cards: data.cards,
            suggestions: data.suggestions,
            comparison: data.comparison,
            plan: data.plan,
            tracking: data.tracking,
            fulfillment: data.fulfillment,
            cart: data.cart,
            budget_vnd: data.budget_vnd,
            toolFilter: data.toolFilter ?? data.tool_filter ?? null,
          },
        ]
      })
    } catch {
      setFailed(true)
      // Drop the empty placeholder on failure so the transcript stays clean.
      setEntries((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && !last.content && !last.cards?.length) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setPending(false)
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }

  function sendSuggestion(text: string) {
    void send(text)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở trợ lý mua sắm"
        className="fixed bottom-20 right-4 z-40 grid size-12 place-items-center rounded-full bg-brand text-accent-fg shadow-lg hover:bg-brand-hover"
      >
        ✦
      </button>
    )
  }

  return (
    <section
      aria-label="Trợ lý mua sắm TechStore"
      className="fixed bottom-20 right-4 z-40 flex h-[min(560px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-bg-primary shadow-xl"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-(length:--text-sm) font-semibold text-fg">Trợ lý TechStore</p>
          <p className="text-(length:--text-xs) text-fg-muted">Tư vấn chọn máy · Tra cứu đơn</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && entries[entries.length - 1].budget_vnd && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-(length:--text-xs) font-medium text-brand">
              💰 Ngân sách: {formatPrice(entries[entries.length - 1].budget_vnd!)}
            </span>
          )}
          {entries.length > 0 && entries[entries.length - 1].cart && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-(length:--text-xs) font-medium text-brand">
              🛒 {entries[entries.length - 1].cart!.item_count} món · {formatPrice(entries[entries.length - 1].cart!.subtotal)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Đóng trợ lý"
          className="grid size-8 place-items-center rounded-(--radius-md) text-fg-muted hover:bg-surface-muted"
        >
          ✕
        </button>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {entries.map((entry, i) => (
          <div key={i} className={entry.role === 'user' ? 'self-end' : 'self-start'}>
            <div
              className={
                entry.role === 'user'
                  ? 'max-w-64 rounded-(--radius-md) bg-brand px-3 py-2 text-(length:--text-sm) text-accent-fg'
                  : 'max-w-72 rounded-(--radius-md) bg-surface-muted px-3 py-2 text-(length:--text-sm) text-fg'
              }
            >
              {entry.role === 'assistant' && entry.content ? <AssistantReply content={entry.content} /> : entry.content}
            </div>
            {entry.cards && entry.cards.length > 0 ? (
              <ProductCards
                cards={entry.cards}
                entryIndex={i}
                onAddToCart={(card) => sendSuggestion(`Thêm ${card.name} vào giỏ giúp mình`)}
              />
            ) : null}
            {entry.comparison && entry.comparison.rows.length > 0 ? (
              <CompareMatrixView matrix={entry.comparison} />
            ) : null}
            {entry.plan && entry.plan.lines.length > 0 ? (
              <ShoppingPlanView plan={entry.plan} onSend={sendSuggestion} />
            ) : null}
            {entry.tracking ? <OrderTrackingView tracking={entry.tracking} /> : null}
            {entry.fulfillment ? <FulfillmentView fulfillment={entry.fulfillment} /> : null}
            {entry.toolFilter ? <JevBadge info={entry.toolFilter} /> : null}
            {(() => {
              const chips =
                entry.suggestions && entry.suggestions.length > 0
                  ? entry.suggestions
                  : entry.role === 'assistant' && entry.content
                    ? fallbackSuggestions(entry)
                    : []
              return chips.length > 0 ? (
                <div className="mt-2 flex max-w-72 flex-wrap gap-1.5">
                  {chips.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendSuggestion(s)}
                      className="rounded-full border border-brand/40 px-2.5 py-1 text-(length:--text-xs) font-medium text-brand hover:bg-brand/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null
            })()}
          </div>
        ))}
        {(() => {
          const last = entries[entries.length - 1]
          if (!pending || last?.role !== 'assistant') return null
          const steps = last.activity ?? []
          return (
            <>
              {!last.content ? <ThinkingBubble variant="shopping" intent={last.intent ?? 'default'} /> : null}
              {steps.length > 0 ? <AgentActivityList calls={steps} /> : null}
            </>
          )
        })()}
        {failed ? (
          <p className="text-(length:--text-xs) text-danger" role="alert">
            Không gửi được. Kiểm tra mạng rồi thử lại.
          </p>
        ) : null}
      </div>

      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send(draft)
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Hỏi về máy, giá, đơn hàng…"
          maxLength={1000}
          aria-label="Nhắn cho trợ lý"
          className="min-h-10 flex-1 rounded-(--radius-md) border border-border bg-bg-elevated px-3 text-(length:--text-sm) text-fg"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-(--radius-md) bg-brand px-4 text-(length:--text-sm) font-semibold text-accent-fg disabled:opacity-50"
        >
          Gửi
        </button>
      </form>
    </section>
  )
}
