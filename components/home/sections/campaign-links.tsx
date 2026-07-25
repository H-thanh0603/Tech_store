import Image from 'next/image'
import Link from 'next/link'

import { ScrollReveal } from '@/components/home/scroll-reveal'
import { bannersFor, type SectionProps } from '@/components/home/sections/types'
import { IconTag } from '@/components/ui/icons'

/**
 * Campaign quick links (§4.2).
 *
 * Compact entry points straight under the hero. Each card is one editable banner
 * row, so a campaign that ends simply stops being returned by RLS and the row
 * disappears — no code change, no dead link.
 */
export function CampaignLinksSection({ section, context }: SectionProps) {
  const banners = bannersFor(context, section.config.bannerSlot ?? 'home_campaign_strip', section.config.limit ?? 6)
  if (banners.length === 0) {
    return null
  }

  return (
    <section aria-label={section.title ?? 'Ưu đãi đang diễn ra'} className="border-b border-border bg-bg-secondary/60">
      <div className="container-store py-4">
        <ul className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 snap-x md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-6">
          {banners.map((banner) => (
            <li key={banner.id} className="w-56 shrink-0 snap-start md:w-auto">
              <Link
                href={banner.href}
                className="flex h-full min-h-16 items-center gap-2.5 rounded-(--radius-md) border border-border bg-bg-elevated px-3 py-2.5 shadow-(--shadow-sm) transition-colors hover:border-brand hover:bg-brand-soft"
              >
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-(--radius-md) bg-brand-soft text-brand"
                >
                  <IconTag size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-(length:--text-sm) font-semibold text-fg">
                    {banner.title ?? banner.name}
                  </span>
                  {banner.subtitle ? (
                    <span className="line-clamp-1 text-(length:--text-xs) text-fg-muted">
                      {banner.subtitle}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * Generic banner grid (§4.1 secondary slots). Still available for editors who
 * want promo cards in their own band rather than inside the hero.
 */
export function BannerGridSection({ section, context }: SectionProps) {
  const banners = bannersFor(context, section.config.bannerSlot, section.config.limit ?? 3)
  if (banners.length === 0) {
    return null
  }

  return (
    <section
      aria-label={section.title ?? 'Banner ưu đãi'}
      className="border-b border-border bg-bg-secondary/50"
    >
      <div className="container-store grid gap-3 py-6 md:grid-cols-3">
        {banners.map((banner, index) => (
          <ScrollReveal key={banner.id} delayMs={index * 80}>
            <Link
              href={banner.href}
              className="reveal-soft group flex h-full min-h-36 flex-col justify-between overflow-hidden rounded-(--radius-xl) border border-border bg-bg-elevated p-5 shadow-(--shadow-sm)"
            >
              {banner.imageDesktopUrl ? (
                <span className="relative mb-3 block aspect-[16/9] overflow-hidden rounded-(--radius-md)">
                  <Image
                    src={banner.imageDesktopUrl}
                    alt={banner.title ?? ''}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </span>
              ) : null}
              <span className="block">
                <span className="block text-(length:--text-lg) font-semibold tracking-tight text-fg">
                  {banner.title ?? banner.name}
                </span>
                {banner.subtitle ? (
                  <span className="mt-1 block text-(length:--text-sm) text-fg-muted">
                    {banner.subtitle}
                  </span>
                ) : null}
              </span>
              <span className="mt-4 text-(length:--text-sm) font-semibold text-brand group-hover:underline">
                Khám phá →
              </span>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
