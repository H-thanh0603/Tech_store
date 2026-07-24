import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  id: string
  error?: string
}

export function Input({ label, id, error, className, ...props }: InputProps) {
  const errorId = error ? `${id}-error` : undefined

  const classes = [
    'min-h-(--size-touch) w-full rounded-(--radius-md) border px-3 text-(length:--text-sm)',
    'bg-surface text-fg placeholder:text-fg-subtle',
    'border-border focus-visible:border-accent',
    error ? 'border-danger' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-(length:--text-sm) font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-(length:--text-xs) text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
