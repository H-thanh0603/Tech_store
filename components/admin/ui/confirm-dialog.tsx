'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive styling for dangerous actions. */
  tone?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onCancel()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-fg/40"
        aria-label="Đóng hộp thoại"
        disabled={loading}
        onClick={() => {
          if (!loading) onCancel()
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative z-10 w-full max-w-md rounded-(--radius-lg) border border-border bg-surface-raised p-5 shadow-(--shadow-lg)"
      >
        <h2 id={titleId} className="text-(length:--text-lg) font-semibold text-fg">
          {title}
        </h2>
        {description ? (
          <div id={descriptionId} className="mt-2 text-(length:--text-sm) text-fg-muted">
            {description}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'primary' : 'primary'}
            className={tone === 'danger' ? 'bg-danger hover:bg-danger active:bg-danger' : undefined}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
