import type { HTMLAttributes } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border border-border bg-surface-raised/95 text-fg-muted backdrop-blur-sm',
  accent: 'border border-accent/20 bg-accent-subtle text-accent-active',
  success: 'border border-success/20 bg-success-subtle text-success',
  danger: 'border border-danger/20 bg-danger-subtle text-danger',
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  const classes = [
    'inline-flex items-center rounded-full px-2.5 py-0.5',
    'text-xs font-semibold tracking-wide',
    'shadow-(--shadow-sm)',
    TONE_CLASSES[tone],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes} {...props} />
}
