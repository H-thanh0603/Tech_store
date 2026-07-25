'use client'

import { useId, type InputHTMLAttributes } from 'react'

import { FormField } from '@/components/admin/ui/form-field'

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  id?: string
  label: string
  error?: string
  hint?: string
}

export function NumberInput({
  id,
  label,
  error,
  hint,
  className,
  required,
  ...props
}: NumberInputProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FormField id={fieldId} label={label} error={error} hint={hint} required={required}>
      <input
        id={fieldId}
        type="number"
        inputMode="numeric"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={[
          'min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm) text-fg tabular-nums shadow-(--shadow-sm)',
          'placeholder:text-fg-subtle focus-visible:border-accent focus-visible:shadow-(--shadow-glow)',
          error ? 'border-danger' : '',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        required={required}
        {...props}
      />
    </FormField>
  )
}
