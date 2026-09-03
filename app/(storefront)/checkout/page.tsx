import { redirect } from 'next/navigation'

import { CheckoutForm } from '@/components/commerce/checkout-form'
import { CheckoutStepper } from '@/components/commerce/checkout-stepper'
import { getCart } from '@/lib/commerce/queries'
import { getPickupStoresForCart } from '@/lib/commerce/pickup'
import { getVnpayConfig } from '@/lib/commerce/vnpay'

export default async function CheckoutPage() {
  const [cart, pickupStores] = await Promise.all([getCart(), getPickupStoresForCart()])
  if (cart.items.length === 0) {
    redirect('/cart')
  }
  return (
    <div className="container-store py-8 sm:py-10">
      <CheckoutStepper current={2} />
      <CheckoutForm
        cart={cart}
        initialState={{ ok: true }}
        vnpayEnabled={getVnpayConfig() !== null}
        pickupStores={pickupStores}
      />
    </div>
  )
}
