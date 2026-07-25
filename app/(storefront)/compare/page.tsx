import { CompareClient } from '@/components/commerce/wishlist-compare-pages'

export const metadata = {
  title: 'So sánh | TechStore',
  description: 'So sánh tối đa 4 sản phẩm đã chọn.',
}

export default function ComparePage() {
  return (
    <div className="container-store py-8 sm:py-10">
      <CompareClient />
    </div>
  )
}
