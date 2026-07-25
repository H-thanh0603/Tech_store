import { TrackOrderForm } from '@/components/commerce/track-order-form'

export default function TrackOrderPage() {
  return (
    <div className="container-store grid max-w-lg gap-6 py-10 sm:py-14">
      <header className="text-center">
        <p className="eyebrow">Hỗ trợ</p>
        <h1 className="mt-2 text-(length:--text-3xl) font-semibold tracking-tight">
          Tra cứu đơn hàng
        </h1>
        <p className="mt-2 text-(length:--text-sm) text-fg-muted">
          Nhập mã đơn và số điện thoại đã dùng khi đặt hàng.
        </p>
      </header>
      <TrackOrderForm />
    </div>
  )
}
