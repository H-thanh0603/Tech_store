import { CartPageContent } from '@/components/commerce/cart-page-content'
import { CartUpsell } from '@/components/commerce/cart-upsell'
import { getCart } from '@/lib/commerce/queries'

export default async function CartPage() {
  const cart = await getCart()
  return (
    <div className="container-store py-8 sm:py-10">
      <CartPageContent cart={cart} />
      {cart.items.length > 0 ? (
        <div className="mt-10">
          <CartUpsell excludeSlugs={cart.items.map((item) => item.productSlug)} />
        </div>
      ) : null}
    </div>
  )
}
