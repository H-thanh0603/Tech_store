import Link from 'next/link'
import type { ReactNode } from 'react'

type SectionHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actionHref?: string
  actionLabel?: string
  align?: 'left' | 'center'
  titleId?: string
  children?: ReactNode
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  align = 'left',
  titleId,
  children,
}: SectionHeaderProps) {
  return (
    <div
      className={`mb-8 flex flex-col gap-4 md:mb-10 ${
        align === 'center' ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between'
      }`}
    >
      <div className={align === 'center' ? 'max-w-2xl' : 'max-w-2xl'}>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2
          id={titleId}
          className="mt-1 text-balance text-(length:--text-2xl) font-semibold tracking-tight text-fg md:text-(length:--text-3xl)"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-xl text-(length:--text-base) leading-relaxed text-fg-muted">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex min-h-11 shrink-0 items-center text-(length:--text-sm) font-semibold text-accent transition-colors hover:text-accent-hover"
        >
          {actionLabel}
          <span aria-hidden className="ml-1">
            →
          </span>
        </Link>
      ) : null}
    </div>
  )
}
