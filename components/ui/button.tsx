import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active',
  secondary:
    'border border-border bg-surface text-fg hover:bg-surface-muted active:bg-surface-muted',
  ghost: 'bg-transparent text-fg hover:bg-surface-muted active:bg-surface-muted',
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'inline-flex min-h-11 items-center justify-center gap-2',
    'rounded-md px-4 text-sm font-medium',
    'transition-colors duration-150 ease-out',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASSES[variant],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <button type={type} className={classes} {...props} />
}
