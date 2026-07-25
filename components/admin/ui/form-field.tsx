import type { ReactNode } from 'react'

type FormFieldProps = {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export function FormField({ id, label, error, hint, required, children }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint && !error ? `${id}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5" data-invalid={error ? true : undefined}>
      <label htmlFor={id} className="text-(length:--text-sm) font-medium text-fg">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <div data-form-control="" data-describedby={describedBy}>
        {children}
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-(length:--text-xs) text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-(length:--text-xs) text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
