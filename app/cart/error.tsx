'use client'

import { Button } from '@/components/ui/button'

export default function CartError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <section aria-labelledby="cart-error-heading" className="flex flex-col items-start gap-4 py-12">
      <h1 id="cart-error-heading" className="text-(length:--text-2xl) font-semibold text-fg">
        Không thể tải giỏ hàng
      </h1>
      <p className="text-fg-muted">Vui lòng thử lại sau.</p>
      <Button type="button" onClick={reset}>
        Thử lại
      </Button>
    </section>
  )
}
