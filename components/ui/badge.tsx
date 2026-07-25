import type { HTMLAttributes } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border border-border bg-surface-raised/95 text-fg-muted',
  accent: 'border border-accent/20 bg-accent-subtle text-accent',
  success: 'border border-success/20 bg-success-subtle text-success',
  danger: 'border border-danger/20 bg-danger-subtle text-danger',
  warning: 'border border-warm/30 bg-warm-subtle text-fg',
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  const classes = [
    'inline-flex items-center rounded-full px-2.5 py-0.5',
    'text-xs font-semibold tracking-wide',
    TONE_CLASSES[tone],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes} {...props} />
}
