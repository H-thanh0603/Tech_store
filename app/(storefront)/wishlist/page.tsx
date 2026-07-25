import { WishlistClient } from '@/components/commerce/wishlist-compare-pages'

export const metadata = {
  title: 'Wishlist | TechStore',
  description: 'Sản phẩm bạn đã lưu — lưu trên thiết bị, không cần tài khoản.',
}

export default function WishlistPage() {
  return (
    <div className="container-store py-8 sm:py-10">
      <WishlistClient />
    </div>
  )
}
