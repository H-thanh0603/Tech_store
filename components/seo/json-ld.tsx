export function JsonLd({
  data,
  nonce,
}: {
  data: Record<string, unknown> | Record<string, unknown>[]
  nonce?: string
}) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
