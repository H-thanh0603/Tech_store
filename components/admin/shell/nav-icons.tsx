import type { ReactNode } from 'react'

import type { AdminModule } from '@/lib/admin/permissions'

type IconProps = { className?: string }

function Svg({
  className,
  children,
  title,
}: {
  className?: string
  children: ReactNode
  title: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-5 w-5 shrink-0'}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

const ICONS: Record<AdminModule, (props: IconProps) => ReactNode> = {
  dashboard: ({ className }) => (
    <Svg className={className} title="">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Svg>
  ),
  products: ({ className }) => (
    <Svg className={className} title="">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </Svg>
  ),
  categories: ({ className }) => (
    <Svg className={className} title="">
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h14" />
    </Svg>
  ),
  brands: ({ className }) => (
    <Svg className={className} title="">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4-6 8-6s6.5 2 8 6" />
    </Svg>
  ),
  inventory: ({ className }) => (
    <Svg className={className} title="">
      <path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M3 7 5.5 3h13L21 7" />
      <path d="M10 12h4" />
    </Svg>
  ),
  orders: ({ className }) => (
    <Svg className={className} title="">
      <path d="M9 5h10v14H5V9l4-4z" />
      <path d="M9 5v4H5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </Svg>
  ),
  customers: ({ className }) => (
    <Svg className={className} title="">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c1-3.5 3.5-5 6-5s5 1.5 6 5" />
      <path d="M15 14.5c1.5 0 3.5 1 4.5 4" />
    </Svg>
  ),
  coupons: ({ className }) => (
    <Svg className={className} title="">
      <path d="M4 9a2 2 0 0 1 0-4h16v4a2 2 0 1 0 0 4v4H4a2 2 0 1 0 0-4V9z" />
      <path d="M12 5v14" strokeDasharray="2 3" />
    </Svg>
  ),
  reports: ({ className }) => (
    <Svg className={className} title="">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15v-4" />
      <path d="M12 15V8" />
      <path d="M16 15v-6" />
    </Svg>
  ),
  settings: ({ className }) => (
    <Svg className={className} title="">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
}

export function NavIcon({ module, className }: { module: AdminModule; className?: string }) {
  const Icon = ICONS[module]
  return <>{Icon({ className })}</>
}
