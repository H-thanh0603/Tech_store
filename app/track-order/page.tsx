import { TrackOrderForm } from '@/components/commerce/track-order-form'

export default function TrackOrderPage() {
  return <div className="grid gap-6"><header className="text-center"><h1 className="text-3xl font-semibold">Tra cứu đơn hàng</h1><p className="mt-2 text-fg-muted">Nhập mã đơn và số điện thoại đã đặt hàng.</p></header><TrackOrderForm /></div>
}
