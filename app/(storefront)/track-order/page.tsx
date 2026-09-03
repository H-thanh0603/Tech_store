import { TrackOrderForm } from '@/components/commerce/track-order-form'

export default function TrackOrderPage() {
  return (
    <div className="container-store grid max-w-lg gap-6 py-10 sm:py-14">
      <header className="text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-(--radius-lg) bg-brand-soft text-brand">
          <span aria-hidden className="text-xl">
            📦
          </span>
        </div>
        <p className="eyebrow mt-3">Hỗ trợ</p>
        <h1 className="mt-1 text-(length:--text-3xl) font-semibold tracking-tight">Tra cứu đơn hàng</h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Nhập mã đơn và số điện thoại đã dùng khi đặt hàng. Không cần đăng nhập.
        </p>
        <ul className="mx-auto mt-3 flex flex-wrap justify-center gap-2 text-(length:--text-xs) text-fg-subtle">
          <li className="rounded-full border border-border px-2.5 py-1">Bảo mật bằng mã + SĐT</li>
          <li className="rounded-full border border-border px-2.5 py-1">Rate-limit 5/15 phút</li>
        </ul>
      </header>
      <TrackOrderForm />
      <p className="text-center text-(length:--text-xs) text-fg-subtle">
        Gặp sự cố? Liên hệ hỗ trợ kèm mã đơn để được xử lý nhanh.
      </p>
    </div>
  )
}
