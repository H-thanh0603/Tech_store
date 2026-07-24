import { CartPageContent } from '@/components/commerce/cart-page-content'
import { getCart } from '@/lib/commerce/queries'

export default async function CartPage() {
  const cart = await getCart()
  return <CartPageContent cart={cart} />
}
