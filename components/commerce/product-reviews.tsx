import type { ProductReview } from '@/lib/catalog/social'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5 text-warm" aria-label={`${rating} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden className={i < rating ? 'opacity-100' : 'opacity-25'}>
          ★
        </span>
      ))}
    </span>
  )
}

export function ProductReviews({
  reviews,
  average,
  count,
}: {
  reviews: ProductReview[]
  average: number
  count: number
}) {
  return (
    <section aria-labelledby="reviews-heading" className="border-t border-border pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Đánh giá thật</p>
          <h2 id="reviews-heading" className="mt-1 text-(length:--text-2xl) font-semibold tracking-tight">
            Khách hàng nói gì
          </h2>
        </div>
        {count > 0 ? (
          <p className="text-(length:--text-sm) text-fg-muted">
            <span className="font-semibold text-fg">{average}</span> / 5 · {count} đánh giá
          </p>
        ) : null}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-6 text-(length:--text-sm) text-fg-muted">
          Chưa có đánh giá công khai cho sản phẩm này.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-(--radius-lg) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-fg">{r.authorName}</p>
                <Stars rating={r.rating} />
              </div>
              {r.title ? <p className="mt-2 text-(length:--text-sm) font-medium">{r.title}</p> : null}
              <p className="mt-2 text-(length:--text-sm) leading-relaxed text-fg-muted">{r.body}</p>
              <p className="mt-3 text-(length:--text-xs) text-fg-subtle">
                {new Date(r.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
