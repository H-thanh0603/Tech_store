'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'

import { formatPrice } from '@/lib/format'
import { readChatStream } from '@/lib/assistant/sse'

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
}

const HELLO: ChatEntry = {
  role: 'assistant',
  content:
    'Chào bạn, mình là trợ lý TechStore. Bạn cần tìm máy gì, ngân sách bao nhiêu — hoặc muốn tra cứu đơn hàng?',
  suggestions: ['Laptop học tập dưới 20 triệu', 'iPhone cũ còn hàng không', 'Tra cứu đơn hàng'],
}

async function postChat(
  messages: { role: string; content: string }[],
  onText: (delta: string) => void,
) {
  const res = await fetch('/api/v1/assistant/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-10), stream: true }),
  })
  return readChatStream<{
    reply: string
    cards: AssistantCard[]
    suggestions: string[]
  }>(res, onText)
}

function ProductMiniCard({ card }: { card: AssistantCard }) {
  return (
    <Link
      href={card.url}
      className="flex w-40 shrink-0 flex-col overflow-hidden rounded-(--radius-md) border border-border bg-bg-elevated"
    >
      <div className="relative aspect-[4/3] bg-bg-secondary/60">
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
    const next = [...entries, { role: 'user', content: clean } as ChatEntry]
    // Placeholder assistant entry streams deltas into place.
    setEntries([...next, { role: 'assistant', content: '' } as ChatEntry])
    setPending(true)
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
              {entry.content}
            </div>
            {entry.cards && entry.cards.length > 0 ? (
              <div className="mt-2 flex max-w-72 gap-2 overflow-x-auto pb-1">
                {entry.cards.map((card) => (
                  <ProductMiniCard key={card.product_id} card={card} />
                ))}
              </div>
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
        {pending ? (
          <p className="text-(length:--text-xs) text-fg-muted" role="status">
            Trợ lý đang trả lời…
          </p>
        ) : null}
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
