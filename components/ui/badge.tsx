import type { HTMLAttributes } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-fg-muted',
  accent: 'bg-accent-subtle text-accent-active',
  success: 'bg-surface-muted text-success',
  danger: 'bg-danger-subtle text-danger',
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  const classes = [
    'inline-flex items-center rounded-full px-2.5 py-0.5',
    'text-xs font-medium',
    TONE_CLASSES[tone],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes} {...props} />
}
