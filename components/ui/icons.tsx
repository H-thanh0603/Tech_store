import type { ComponentType, SVGProps } from 'react'

/**
 * Inline SVG icon set for the storefront chrome.
 *
 * Why not emoji: emoji render differently per platform, cannot inherit stroke
 * weight and ignore design tokens. Every icon here is a 24px grid, 1.75 stroke,
 * `currentColor`, round caps — one visual family across header, nav and cards.
 *
 * Icons are decorative by default (`aria-hidden`): the interactive element that
 * wraps them carries the accessible name.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconMenu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </Svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </Svg>
  )
}

export function IconHeart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" />
    </Svg>
  )
}

export function IconCompare(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </Svg>
  )
}

export function IconCart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h2.2l2.3 10.2A2 2 0 0 0 9.5 16h8.2a2 2 0 0 0 1.9-1.4L21.5 8H6" />
      <circle cx="10" cy="19.5" r="1.4" />
      <circle cx="18" cy="19.5" r="1.4" />
    </Svg>
  )
}

export function IconTruck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </Svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11l8-6.5 8 6.5" />
      <path d="M6.5 10v9h11v-9" />
    </Svg>
  )
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Svg>
  )
}

export function IconReceipt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </Svg>
  )
}

export function IconMapPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </Svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9.5l6 5.5 6-5.5" />
    </Svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 6l5.5 6-5.5 6" />
    </Svg>
  )
}

export function IconShieldCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 2.5v5.8c0 4.3-2.9 7.6-7 9.7-4.1-2.1-7-5.4-7-9.7V5.5z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </Svg>
  )
}

export function IconTag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.6 3.4H20V11l-8.6 8.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8z" />
      <circle cx="16.4" cy="7.2" r="1.3" />
    </Svg>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-13.7-4.7L4 8.5" />
      <path d="M4 5v4h4" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" />
      <path d="M20 19v-4h-4" />
    </Svg>
  )
}

export function IconFileText(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" />
      <path d="M13 3v5h5M9 13h6M9 16.5h4" />
    </Svg>
  )
}

export function IconHeadphones(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 15v-2a7 7 0 0 1 14 0v2" />
      <rect x="3" y="14" width="3.5" height="6" rx="1.5" />
      <rect x="17.5" y="14" width="3.5" height="6" rx="1.5" />
    </Svg>
  )
}

export function IconSmartphone(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18.2h2" />
    </Svg>
  )
}

export function IconLaptop(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="10" rx="1.5" />
      <path d="M3 18.5h18" />
    </Svg>
  )
}

export function IconMonitor(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="11" rx="1.5" />
      <path d="M9 19.5h6M12 15.5v4" />
    </Svg>
  )
}

export function IconKeyboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8.5 14h7" />
    </Svg>
  )
}

export function IconSupport(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 13v-1a7 7 0 0 1 14 0v1" />
      <path d="M5 13h2.5v5H6a1 1 0 0 1-1-1zM19 13h-2.5v5H18a1 1 0 0 0 1-1z" />
      <path d="M12 21h2a2.5 2.5 0 0 0 2.5-2.5" />
    </Svg>
  )
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l1.8 4.7L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z" />
      <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </Svg>
  )
}

/**
 * Icon lookup for CMS-driven navigation (`navigation_items.icon_key`).
 * An unknown key resolves to null so a menu entry renders without an icon
 * rather than with a broken placeholder.
 */
export const NAV_ICONS = {
  smartphone: IconSmartphone,
  laptop: IconLaptop,
  monitor: IconMonitor,
  headphones: IconHeadphones,
  keyboard: IconKeyboard,
  tag: IconTag,
  truck: IconTruck,
  grid: IconGrid,
  sparkle: IconSparkle,
  shield: IconShieldCheck,
  support: IconSupport,
} as const

export type NavIconKey = keyof typeof NAV_ICONS

export function navIcon(key: string | null | undefined): ComponentType<IconProps> | null {
  if (!key) {
    return null
  }
  return (NAV_ICONS as Record<string, ComponentType<IconProps>>)[key] ?? null
}
