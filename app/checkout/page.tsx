import { redirect } from 'next/navigation'

import { CheckoutForm } from '@/components/commerce/checkout-form'
import { getCart } from '@/lib/commerce/queries'

export default async function CheckoutPage() {
  const cart = await getCart()
  if (cart.items.length === 0) {
    redirect('/cart')
  }
  return <CheckoutForm cart={cart} initialState={{ ok: true }} />
}
