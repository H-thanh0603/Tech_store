'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastInput = {
  title: string
  description?: string
  tone?: ToastTone
  durationMs?: number
}

type ToastItem = ToastInput & {
  id: string
  tone: ToastTone
}

type ToastContextValue = {
  toast: (input: ToastInput) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `toast-${++toastCounter}`
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? 'info',
        durationMs: input.durationMs,
      }
      setItems((prev) => [...prev.slice(-4), item])
      const duration = input.durationMs ?? 3800
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-end gap-2 p-4 sm:p-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`animate-toast-in pointer-events-auto w-full max-w-sm rounded-(--radius-lg) border px-4 py-3 shadow-(--shadow-lg) backdrop-blur-sm ${
              item.tone === 'success'
                ? 'border-success/30 bg-success-subtle text-fg'
                : item.tone === 'error'
                  ? 'border-danger/30 bg-danger-subtle text-fg'
                  : 'border-border bg-bg-elevated/95 text-fg'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-(length:--text-xs) font-bold ${
                  item.tone === 'success'
                    ? 'bg-success text-white'
                    : item.tone === 'error'
                      ? 'bg-danger text-white'
                      : 'bg-brand text-accent-fg'
                }`}
              >
                {item.tone === 'success' ? '✓' : item.tone === 'error' ? '!' : 'i'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-(length:--text-sm) font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-(length:--text-sm) text-fg-muted">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-(--radius-md) text-fg-muted hover:bg-surface-muted hover:text-fg"
                onClick={() => dismiss(item.id)}
                aria-label="Đóng thông báo"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

/** Safe toast when provider may be missing (e.g. isolated tests). */
export function useOptionalToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  return (
    ctx ?? {
      toast: () => {},
      dismiss: () => {},
    }
  )
}
