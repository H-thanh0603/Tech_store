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

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string
  cards?: AssistantCard[]
  suggestions?: string[]
  /** Detected intent of the user message that triggered this entry. */
  intent?: ShoppingIntent
  /** Real-time Agent Activity UI: tool calls streamed during this turn. */
  activity?: AgentCall[]
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

function ProductMiniCard({ card, wide = false }: { card: AssistantCard; wide?: boolean }) {
  return (
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
  )
}

/**
 * Horizontal card carousel: arrows on both sides page the strip. Scroll is
 * driven imperatively so the arrows work even without native smooth snapping.
 */
function CardCarousel({ cards }: { cards: AssistantCard[] }) {
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
            <ProductMiniCard card={card} />
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
function CardStack({ cards }: { cards: AssistantCard[] }) {
  return (
    <div className="mt-2 flex max-w-72 flex-col gap-2">
      {cards.map((card) => (
        <ProductMiniCard key={card.product_id} card={card} wide />
      ))}
    </div>
  )
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

/** Card display mode: horizontal arrows carousel or vertical stack. */
type CardLayout = 'horizontal' | 'vertical'

function ProductCards({ cards, entryIndex }: { cards: AssistantCard[]; entryIndex: number }) {
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
        <CardCarousel key={`h-${entryIndex}`} cards={cards} />
      ) : (
        <CardStack key={`v-${entryIndex}`} cards={cards} />
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
      setEntries((prev) => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        if (last.role !== 'assistant') return prev
        return [
          ...prev.slice(0, -1),
          { role: 'assistant', content: data.reply, cards: data.cards, suggestions: data.suggestions },
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
              <ProductCards cards={entry.cards} entryIndex={i} />
            ) : null}
            {entry.suggestions && entry.suggestions.length > 0 ? (
              <div className="mt-2 flex max-w-72 flex-wrap gap-1.5">
                {entry.suggestions.map((s) => (
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
            ) : null}
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
