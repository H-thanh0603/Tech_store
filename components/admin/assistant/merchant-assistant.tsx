'use client'

import { useEffect, useRef, useState } from 'react'

import { readChatStream } from '@/lib/assistant/sse'

interface StagedItem {
  productId: string
  name: string
  before: string
  after: string
}

interface StagedEnvelope {
  change: {
    id: string
    kind: 'publish' | 'price' | 'stock'
    summary: string
    note: string | null
    items: StagedItem[]
    createdAt: string
  }
  signature: string
}

interface Entry {
  role: 'user' | 'assistant'
  content: string
  suggestions?: string[]
}

interface PendingCard {
  changeId: string
  kind: 'publish' | 'price' | 'stock'
  summary: string
  note: string | null
  items: StagedItem[]
  createdAt: string
  status: 'staged' | 'applying' | 'applied' | 'failed' | 'dropped'
  result?: string
}

const HELLO: Entry = {
  role: 'assistant',
  content:
    'Chào bạn, mình là trợ lý vận hành. Hỏi mình về doanh thu, tồn kho, đơn chờ xử lý — hoặc nhờ stage thay đổi giá/xuất bản/nhập hàng.',
  suggestions: ['Doanh thu 7 ngày qua?', 'Hàng nào sắp hết?', 'Đơn nào đang chờ xử lý?'],
}

async function postChat(
  messages: { role: string; content: string }[],
  onText: (delta: string) => void,
) {
  const res = await fetch('/api/v1/assistant/merchant/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-10), stream: true }),
  })
  return readChatStream<{
    reply: string
    staged: StagedEnvelope[]
    suggestions: string[]
  }>(res, onText)
}

async function postDecision(changeId: string, decision: 'apply' | 'discard') {
  const res = await fetch('/api/v1/assistant/merchant/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ changeId, decision }),
  })
  const data = (await res.json()) as { ok: boolean; message: string }
  if (!res.ok && !data.message) throw new Error(`HTTP ${res.status}`)
  return data
}

async function fetchPending(): Promise<PendingCard[]> {
  const res = await fetch('/api/v1/assistant/merchant/pending')
  if (!res.ok) return []
  const data = (await res.json()) as { pending: Omit<PendingCard, 'status'>[] }
  return data.pending.map((p) => ({ ...p, status: 'staged' as const }))
}

export function MerchantAssistant() {
  const [entries, setEntries] = useState<Entry[]>([HELLO])
  const [cards, setCards] = useState<PendingCard[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  function scrollDown() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  async function send(text: string) {
    const clean = text.trim().slice(0, 1000)
    if (!clean || pending) return
    setDraft('')
    setFailed(false)
    const next = [...entries, { role: 'user', content: clean } as Entry]
    setEntries([...next, { role: 'assistant', content: '' } as Entry])
    setPending(true)
    const appendDelta = (delta: string) => {
      setEntries((prev) => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        if (last.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
      })
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
          { role: 'assistant', content: data.reply, suggestions: data.suggestions },
        ]
      })
      if (data.staged.length > 0) {
        setCards((prev) => {
          const known = new Set(prev.map((c) => c.changeId))
          const fresh = data.staged
            .filter((s) => !known.has(s.change.id))
            .map((s) => ({
              changeId: s.change.id,
              kind: s.change.kind,
              summary: s.change.summary,
              note: s.change.note,
              items: s.change.items,
              createdAt: s.change.createdAt,
              status: 'staged' as const,
            }))
          return [...prev, ...fresh]
        })
      }
    } catch {
      setFailed(true)
      setEntries((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && !last.content) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setPending(false)
      scrollDown()
    }
  }

  async function decide(id: string, decision: 'apply' | 'discard') {
    const card = cards.find((c) => c.changeId === id)
    if (!card || card.status !== 'staged') return
    setCards((prev) => prev.map((c) => (c.changeId === id ? { ...c, status: 'applying' as const } : c)))
    try {
      const result = await postDecision(id, decision)
      setCards((prev) =>
        prev.map((c) =>
          c.changeId === id
            ? {
                ...c,
                status:
                  decision === 'discard'
                    ? ('dropped' as const)
                    : result.ok
                      ? ('applied' as const)
                      : ('failed' as const),
                result: result.message,
              }
            : c,
        ),
      )
    } catch {
      setCards((prev) =>
        prev.map((c) =>
          c.changeId === id ? { ...c, status: 'failed' as const, result: 'Lỗi mạng, thử lại.' } : c,
        ),
      )
    }
  }

  function approve(id: string) {
    void decide(id, 'apply')
  }

  function drop(id: string) {
    void decide(id, 'discard')
  }

  useEffect(() => {
    let cancelled = false
    fetchPending()
      .then((rows) => {
        if (!cancelled) setCards(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const visibleCards = cards.filter((c) => c.status !== 'dropped')

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <section
        aria-label="Chat trợ lý vận hành"
        className="flex h-[min(640px,72vh)] flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-bg-primary"
      >
        <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {entries.map((entry, i) => (
            <div key={i} className={entry.role === 'user' ? 'self-end' : 'self-start'}>
              <div
                className={
                  entry.role === 'user'
                    ? 'max-w-96 rounded-(--radius-md) bg-brand px-3 py-2 text-(length:--text-sm) text-accent-fg'
                    : 'max-w-96 rounded-(--radius-md) bg-surface-muted px-3 py-2 text-(length:--text-sm) text-fg'
                }
              >
                {entry.content}
              </div>
              {entry.suggestions && entry.suggestions.length > 0 ? (
                <div className="mt-2 flex max-w-96 flex-wrap gap-1.5">
                  {entry.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
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
            <p className="text-(length:--text-xs) text-fg-muted" role="status">Trợ lý đang trả lời…</p>
          ) : null}
          {failed ? (
            <p className="text-(length:--text-xs) text-danger" role="alert">
              Không gửi được. Thử lại nhé.
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
            placeholder="Hỏi doanh thu, tồn kho, đơn chờ… hoặc nhờ stage thay đổi"
            maxLength={1000}
            aria-label="Nhắn cho trợ lý vận hành"
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

      <aside aria-label="Change chờ duyệt" className="flex flex-col gap-3">
        <h2 className="text-(length:--text-sm) font-semibold text-fg">
          Change chờ duyệt ({visibleCards.filter((c) => c.status === 'staged').length})
        </h2>
        {visibleCards.length === 0 ? (
          <p className="rounded-(--radius-md) border border-dashed border-border p-4 text-(length:--text-xs) text-fg-muted">
            Chưa có change nào. Nhờ trợ lý stage thay đổi (ví dụ: “giảm giá 10% 3 laptop bán chậm nhất”),
            thẻ preview kèm nút Duyệt sẽ hiện ở đây. Model không bao giờ tự áp dụng.
          </p>
        ) : null}
        {visibleCards.map((card) => (
          <div
            key={card.changeId}
            className="rounded-(--radius-lg) border border-border bg-bg-primary p-3"
          >
            <p className="text-(length:--text-xs) font-semibold text-fg">{card.summary}</p>
            {card.note ? (
              <p className="mt-1 text-(length:--text-xs) text-fg-muted">Ghi chú: {card.note}</p>
            ) : null}
            <ul className="mt-2 flex flex-col gap-1">
              {card.items.slice(0, 10).map((item) => (
                <li key={item.productId} className="text-(length:--text-xs) text-fg-muted">
                  <span className="font-medium text-fg">{item.name}</span>
                  <br />
                  {item.before} → {item.after}
                </li>
              ))}
              {card.items.length > 10 ? (
                <li className="text-(length:--text-xs) text-fg-muted">
                  …và {card.items.length - 10} dòng nữa
                </li>
              ) : null}
            </ul>
            {card.status === 'staged' ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => approve(card.changeId)}
                  className="rounded-(--radius-md) bg-brand px-3 py-1.5 text-(length:--text-xs) font-semibold text-accent-fg hover:bg-brand-hover"
                >
                  Duyệt & áp dụng
                </button>
                <button
                  type="button"
                  onClick={() => drop(card.changeId)}
                  className="rounded-(--radius-md) border border-border px-3 py-1.5 text-(length:--text-xs) font-medium text-fg-muted hover:bg-surface-muted"
                >
                  Bỏ
                </button>
              </div>
            ) : null}
            {card.status === 'applying' ? (
              <p className="mt-2 text-(length:--text-xs) text-fg-muted" role="status">Đang áp dụng…</p>
            ) : null}
            {card.status === 'applied' ? (
              <p className="mt-2 text-(length:--text-xs) font-medium text-success" role="status">
                Đã áp dụng{card.result ? `: ${card.result}` : '.'}
              </p>
            ) : null}
            {card.status === 'failed' ? (
              <p className="mt-2 text-(length:--text-xs) font-medium text-danger" role="alert">
                {card.result ?? 'Áp dụng thất bại.'}
              </p>
            ) : null}
          </div>
        ))}
      </aside>
    </div>
  )
}
