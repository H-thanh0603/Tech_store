import { CartPageContent } from '@/components/commerce/cart-page-content'
import { getCart } from '@/lib/commerce/queries'

export default async function CartPage() {
  const cart = await getCart()
  return (
    <div className="container-store py-8 sm:py-10">
      <CartPageContent cart={cart} />
    </div>
  )
}
