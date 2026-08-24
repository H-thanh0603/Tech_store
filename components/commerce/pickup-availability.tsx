import type { ProductPickupStore } from '@/lib/commerce/types'

export function PickupAvailability({ stores }: { stores: ProductPickupStore[] }) {
  if (stores.length === 0) return null

  return (
    <details className="rounded-(--radius-lg) border border-border bg-surface-raised p-4">
      <summary className="cursor-pointer text-(length:--text-sm) font-semibold">
        Có thể nhận tại {stores.length} cửa hàng
      </summary>
      <ul className="mt-3 grid gap-3">
        {stores.map((store) => (
          <li key={store.id} className="text-(length:--text-sm)">
            <p className="font-medium">{store.name}</p>
            <p className="text-fg-muted">{store.address} · {store.openingHours}</p>
          </li>
        ))}
      </ul>
    </details>
  )
}
