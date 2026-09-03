'use client'

import { useState } from 'react'

export function CopyButton({ text, label = 'Sao chép' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard may be blocked in insecure context
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex min-h-7 items-center rounded-full border border-border bg-bg-elevated px-2.5 text-(length:--text-xs) font-medium text-fg-muted hover:border-brand hover:text-brand"
      aria-label={label}
    >
      {copied ? 'Đã sao chép ✓' : label}
    </button>
  )
}
