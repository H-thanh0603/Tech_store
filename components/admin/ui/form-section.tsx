import type { ReactNode } from 'react'

type FormSectionProps = {
  title: string
  description?: string
  children: ReactNode
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-sm)">
      <div className="mb-4 border-b border-border pb-3">
        <h3 className="text-(length:--text-base) font-semibold text-fg">{title}</h3>
        {description ? (
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
