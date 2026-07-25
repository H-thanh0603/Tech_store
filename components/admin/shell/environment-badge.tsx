export function EnvironmentBadge() {
  if (process.env.NODE_ENV === 'production') return null

  const label = process.env.VERCEL_ENV === 'preview' ? 'Preview' : 'Development'

  return (
    <span className="inline-flex items-center rounded-full bg-warm-subtle px-2 py-0.5 text-(length:--text-xs) font-semibold text-fg">
      {label}
    </span>
  )
}
