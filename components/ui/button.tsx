import { forwardRef, type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-(--shadow-sm) hover:bg-accent-hover hover:shadow-(--shadow-glow) active:bg-accent-active',
  secondary:
    'border border-border bg-surface-raised text-fg shadow-(--shadow-sm) hover:border-border-strong hover:bg-surface-muted active:bg-surface-muted',
  ghost: 'bg-transparent text-fg hover:bg-surface-muted active:bg-surface-muted',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, type = 'button', ...props },
  ref,
) {
  const classes = [
    'inline-flex min-h-11 items-center justify-center gap-2',
    'rounded-(--radius-md) px-4 text-sm font-semibold tracking-tight',
    'transition-all duration-(--duration-fast) ease-(--ease-out-expo)',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
    VARIANT_CLASSES[variant],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <button ref={ref} type={type} className={classes} {...props} />
})
