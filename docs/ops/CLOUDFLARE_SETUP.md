# Cloudflare free in front of Vercel (CDN + bot protection)

A Cloudflare free account can sit in front of the Vercel deployment to
take most of the bandwidth and L7 abuse load off Vercel and Supabase.
This is the cheapest way to get a real CDN, edge caching for static
assets, and basic bot protection without paying anyone.

## What this gives you

- Global edge cache for `/`, `/products*`, `/products/[slug]`, images,
  and `/_next/static/*`. Most visitors never touch Vercel.
- Free DDoS protection and a managed WAF with sensible defaults.
- Free TLS, HTTP/3, Brotli.
- Bot Fight Mode (off by default — toggle on after the rest works).
- One-click analytics (no extra config; visible in the Cloudflare
  dashboard).

## Cost

Cloudflare Free plan = $0. There is no charge for the bandwidth that
flows through the free plan. Domain DNS is included.

## Setup (about 30 minutes)

1. Buy or move the domain so its authoritative DNS lives on
   Cloudflare. Cloudflare → Add Site → enter the apex domain → Free
   plan → Cloudflare scans existing DNS records.
2. Cloudflare will give you two nameservers (e.g. `annabel.ns.cloudflare.com`).
   At your registrar (Namecheap / TENTEN / etc.) replace the existing
   nameservers with the two Cloudflare ones. Propagation usually
   finishes within an hour but can take up to 24 h.
3. In Cloudflare DNS, add the records so `your-domain` and `www.your-domain`
   point at Vercel. Vercel publishes the exact targets in
   Project → Settings → Domains once you add the domain. Typical
   shape:
   - `A` `@` → `76.76.21.21` (Vercel anycast)
   - `CNAME` `www` → `cname.vercel-dns.com`
4. Cloudflare → SSL/TLS → set the encryption mode to **Full (strict)**.
   Cloudflare issues the edge cert automatically; Vercel still issues
   the origin cert via Let's Encrypt, so both ends are valid.
5. Cloudflare → Caching → Configuration:
   - Browser Cache TTL: **Respect Existing Headers**
   - Crawler Hints: on
6. Cloudflare → Rules → Page Rules (or the newer Redirect Rules):
   - `www.your-domain/*` → 301 → `your-domain/$1` (or whichever way
     you want to canonicalise). One rule, one redirect.
7. Cloudflare → Security → Bots → **Bot Fight Mode**: leave off for
   the first 24 h so you can confirm real users still get through,
   then turn it on.

## What to change in the Vercel project

- Vercel → Project → Settings → Domains → add `your-domain` and
  `www.your-domain`. Vercel will tell you the DNS targets Cloudflare
  needs to point at, then the SSL chain lights up.
- After the deployment on the apex domain goes green, set
  `NEXT_PUBLIC_SITE_URL=https://your-domain` in Vercel env and
  redeploy. This is what populates sitemap.xml, OpenGraph, and the
  JSON-LD canonical URLs.
- Tell the VNPay merchant portal that the return URL and IPN URL are
  now `https://your-domain/...` (the values are configured at the
  gateway, not in the repo).

## Caching strategy

Cloudflare's edge cache for HTML defaults to "no cache". To benefit
from the CDN, every page that should be cached needs an explicit
`Cache-Control: public, max-age=...` response header. The repo has
`revalidate = 60` on `/`, `/products`, and `/products/[slug]`, but
that only takes effect on Vercel's side. To make Cloudflare cache
those HTML responses, add a Cloudflare Cache Rule:

- URL pattern: `your-domain/` and `your-domain/products*` and
  `your-domain/products/*`
- Cache eligibility: eligible
- Edge TTL: 60 seconds (matches the revalidate window)
- Browser TTL: 60 seconds
- Status code: 200 only
- Bypass cache on cookie: `cf-cache-status: HIT` only after first miss

The Cloudflare free plan does not let you set this from a UI
component called "Cache Rules" on every plan, but Page Rules (the
legacy system) works on Free. The rule above is one Page Rule.

For static assets under `/_next/static/*` and `/images/*`, Cloudflare
respects the `Cache-Control: public, max-age=31536000, immutable`
header that `next start` already emits, so no extra rule is needed.

## Origin not exposed

Cloudflare hides Vercel's real origin. Visitors see only
`your-domain`; the Vercel URL (`*.vercel.app`) is never returned.
This is the default and is what you want.

## When Cloudflare will not save you

- **Authenticated pages** (`/account`, `/admin/*`, `/checkout`,
  `/cart`) should never be edge-cached. The Page Rule above is
  deliberately scoped to `/`, `/products`, `/products/*`. Do not
  broaden it.
- **API routes** (`/api/*`) are not cached by this rule. If you ever
  want `/api/catalog/suggest` cached, add an explicit route rule.
- **Vercel function timeout** still applies to the origin. Cloudflare
  in front of Vercel does not change how long a function can run.
- **Cold start latency** on Vercel still happens for the first request
  that misses Cloudflare's edge. Mitigation is the same as without
  Cloudflare: keep `revalidate` short, ensure the monitor workflow
  keeps the Supabase project warm.

## Quick verification

After DNS propagates and Cloudflare is live:

```bash
# Should return Cloudflare's edge, not Vercel
curl -sI https://your-domain | grep -i 'server:'
# server: cloudflare

# Should be cacheable on second hit
curl -sI https://your-domain/ | grep -i 'cf-cache-status'
# cf-cache-status: HIT
```

If `cf-cache-status: DYNAMIC` or `MISS` after a warm-up, the
`Cache-Control` header on the HTML response is too restrictive
or the Page Rule did not match. Adjust the rule and re-test.

## Rollback

If something goes wrong, the only thing tied to Cloudflare is DNS.
Switch the nameservers back at the registrar, and the apex domain
goes back to whatever it pointed at before. The Vercel deployment
keeps running on its `*.vercel.app` URL the whole time, so a bad
rollout is a few minutes of bad cache, not an outage.
