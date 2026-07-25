'use client'

import { useId, type InputHTMLAttributes } from 'react'

import { FormField } from '@/components/admin/ui/form-field'

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  id?: string
  label: string
  error?: string
  hint?: string
}

/**
 * Integer VND input. Stores/emits raw number string; display is controlled by caller.
 * Locale formatting of values for tables uses `formatPrice` separately.
 */
export function CurrencyInput({
  id,
  label,
  error,
  hint,
  className,
  required,
  ...props
}: CurrencyInputProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FormField id={fieldId} label={label} error={error} hint={hint ?? 'Đơn vị: ₫ (VND)'} required={required}>
      <div className="relative">
        <input
          id={fieldId}
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={[
            'min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 pr-10 text-(length:--text-sm) text-fg tabular-nums shadow-(--shadow-sm)',
            'placeholder:text-fg-subtle focus-visible:border-accent focus-visible:shadow-(--shadow-glow)',
            error ? 'border-danger' : '',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
          required={required}
          {...props}
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-(length:--text-sm) text-fg-muted"
          aria-hidden="true"
        >
          ₫
        </span>
      </div>
    </FormField>
  )
}
