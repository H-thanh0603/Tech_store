'use client'

import { useId, type InputHTMLAttributes } from 'react'

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  /** Visually hide the label (still required for a11y). */
  hideLabel?: boolean
}

export function SearchInput({
  id,
  label = 'Tìm kiếm',
  hideLabel = true,
  className,
  ...props
}: SearchInputProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="relative w-full max-w-sm">
      <label
        htmlFor={fieldId}
        className={
          hideLabel
            ? 'sr-only'
            : 'mb-1.5 block text-(length:--text-sm) font-medium text-fg'
        }
      >
        {label}
      </label>
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        id={fieldId}
        type="search"
        className={[
          'min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised py-2 pl-9 pr-3 text-(length:--text-sm) text-fg shadow-(--shadow-sm)',
          'placeholder:text-fg-subtle focus-visible:border-accent focus-visible:shadow-(--shadow-glow)',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    </div>
  )
}
