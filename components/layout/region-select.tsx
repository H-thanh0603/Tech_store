'use client'

import { useId, useSyncExternalStore } from 'react'

import { IconMapPin } from '@/components/ui/icons'
import { getProfile, saveProfile, subscribeCustomer } from '@/lib/customer/profile'

/**
 * Delivery region picker in the header.
 *
 * It writes to the same local profile the checkout form reads (`province`), so
 * the choice actually prefills the order instead of being decoration. Shipping
 * is a flat rate today, so the control deliberately claims nothing about price
 * or delivery time — only where the order will be sent.
 */

const REGIONS = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Bình Dương',
  'Đồng Nai',
  'Khánh Hòa',
  'Thừa Thiên Huế',
  'Nghệ An',
] as const

const EMPTY_CITY = ''

function citySnapshot(): string {
  return getProfile().city
}

function serverCitySnapshot(): string {
  return EMPTY_CITY
}

export function RegionSelect({ className }: { className?: string }) {
  const id = useId()
  const city = useSyncExternalStore(subscribeCustomer, citySnapshot, serverCitySnapshot)

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <IconMapPin size={16} className="shrink-0 text-brand" />
      <label htmlFor={id} className="sr-only">
        Khu vực giao hàng
      </label>
      <select
        id={id}
        value={city}
        onChange={(event) => saveProfile({ city: event.target.value })}
        className="min-h-11 max-w-40 truncate rounded-(--radius-md) border border-transparent bg-transparent px-1 text-(length:--text-sm) font-medium text-fg-muted hover:border-border hover:text-fg focus-visible:border-brand"
      >
        <option value="">Chọn khu vực giao</option>
        {REGIONS.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
    </div>
  )
}
