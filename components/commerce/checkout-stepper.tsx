import Link from 'next/link'

type Step = {
  label: string
  href?: string
}

const STEPS: Step[] = [
  { label: 'Giỏ hàng', href: '/cart' },
  { label: 'Thông tin', href: '/checkout' },
  { label: 'Hoàn tất' },
]

interface CheckoutStepperProps {
  current: 1 | 2 | 3
}

export function CheckoutStepper({ current }: CheckoutStepperProps) {
  return (
    <nav aria-label="Tiến trình đặt hàng" className="mb-6">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < current
          const isCurrent = stepNumber === current
          const isUpcoming = stepNumber > current

          return (
            <li key={step.label} className="flex flex-1 items-center gap-2 last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={[
                    'grid size-7 place-items-center rounded-full text-(length:--text-xs) font-semibold tabular-nums ring-1',
                    isCompleted
                      ? 'bg-success text-success-fg ring-success'
                      : isCurrent
                        ? 'bg-brand text-accent-fg ring-brand'
                        : 'bg-surface-raised text-fg-muted ring-border',
                  ].join(' ')}
                >
                  {isCompleted ? '✓' : stepNumber}
                </span>
                {step.href && !isCurrent && !isUpcoming ? (
                  <Link
                    href={step.href}
                    className="hidden text-(length:--text-sm) font-medium text-fg hover:text-brand sm:inline"
                  >
                    {step.label}
                  </Link>
                ) : (
                  <span
                    className={[
                      'hidden text-(length:--text-sm) sm:inline',
                      isCurrent ? 'font-semibold text-fg' : isCompleted ? 'font-medium text-fg-muted' : 'text-fg-subtle',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                )}
              </div>
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={[
                    'mx-1 h-px flex-1 sm:mx-2',
                    stepNumber < current ? 'bg-success' : 'bg-border',
                  ].join(' ')}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
