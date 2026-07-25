/** Public site origin for SEO (sitemap, robots, canonical, OG). */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (explicit) return explicit

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '')
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`

  return 'http://localhost:3000'
}
