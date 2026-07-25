import Link from 'next/link'

import {
  IconFileText,
  IconRefresh,
  IconShieldCheck,
  IconSupport,
  IconTag,
  IconTruck,
} from '@/components/ui/icons'

/**
 * Utility bar — the retail commitments strip above the header.
 *
 * Desktop shows the items statically (no motion where there is room). Mobile
 * has no room for six items, so it scrolls them in a very slow marquee that
 * stops entirely under `prefers-reduced-motion` (see globals.css) and can also
 * be swiped, because the row stays horizontally scrollable.
 */

const COMMITMENTS = [
  { icon: IconShieldCheck, label: 'Sản phẩm chính hãng', href: '/#trust' },
  { icon: IconFileText, label: 'Xuất hóa đơn đầy đủ', href: '/#trust' },
  { icon: IconTruck, label: 'Giao nhanh toàn quốc', href: '/#trust' },
  { icon: IconRefresh, label: 'Đổi trả theo chính sách', href: '/#trust' },
  { icon: IconTag, label: 'Bảo hành minh bạch', href: '/#trust' },
  { icon: IconSupport, label: 'Tư vấn chọn máy', href: '/#need-selector' },
] as const

function CommitmentItem({
  icon: Icon,
  label,
  href,
}: {
  icon: (typeof COMMITMENTS)[number]['icon']
  label: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 text-(length:--text-xs) font-medium text-fg-inverse/75 transition-colors hover:text-fg-inverse"
    >
      <Icon size={15} className="text-brand-electric" />
      {label}
    </Link>
  )
}

export function CommitmentBar() {
  return (
    <div className="bg-navy-deep text-fg-inverse">
      <div className="container-store py-1.5">
        {/* Desktop: static row, no motion. */}
        <ul className="hidden items-center justify-between gap-4 lg:flex">
          {COMMITMENTS.map((item) => (
            <li key={item.label}>
              <CommitmentItem {...item} />
            </li>
          ))}
        </ul>

        {/* Mobile/tablet: slow marquee, still swipeable. */}
        <div className="overflow-x-auto lg:hidden" aria-hidden>
          <ul className="promo-marquee flex min-w-max items-center gap-6">
            {[...COMMITMENTS, ...COMMITMENTS].map((item, index) => (
              <li key={`${item.label}-${index}`}>
                <CommitmentItem {...item} />
              </li>
            ))}
          </ul>
        </div>
        {/* Screen readers get the list once, without the duplicated marquee copy. */}
        <ul className="sr-only lg:hidden">
          {COMMITMENTS.map((item) => (
            <li key={`sr-${item.label}`}>{item.label}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
