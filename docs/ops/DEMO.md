# Demo script (launch-ready)

Use this for teacher/client walkthroughs after Vercel + Supabase deploy.

## Accounts & secrets

| What | Where |
|------|--------|
| Staff admin | `/admin/login` — password = Vercel env `ADMIN_SECRET` |
| Guest shopper | No account — cart/checkout cookies |
| Supabase Studio | dashboard for “back office” data proof |

Share **admin secret only** with evaluators; rotate after public demos.

## Seed highlights (`supabase/seed.sql`)

After seed you should see:

- Categories: Laptop, Điện thoại, Phụ kiện
- Products: MacBook Air M3, Dell XPS 13, Galaxy S24 Ultra, Buds3 Pro, …
- Coupons (if seed includes them): check `coupons` table — e.g. percentage/fixed demo codes from M3 seed
- Inventory with at least one low-stock / OOS edge case

List coupon codes from Studio if you forget:

```sql
select code, discount_type, discount_value, is_active from coupons order by code;
```

## 10-minute walkthrough

1. **Browse** — `/` → `/products` → filter/sort → open MacBook.  
2. **Detail** — change variant if any; note price/stock; add to cart.  
3. **Cart** — change quantity; apply coupon if available; go checkout.  
4. **Checkout COD** — fill guest info → place order → confirmation page.  
5. **Track** — `/track-order` with order code + phone.  
6. **Admin** — login → dashboard metrics → open order → mark paid / advance status.  
7. **Admin catalog** — edit stock or publish a draft → refresh storefront.  
8. **SEO proof** — open `/sitemap.xml`, `/robots.txt`, view-source PDP for `application/ld+json`.  
9. **Health** — `/api/health`.  
10. **Security note** — guest cannot open `/admin` without secret (middleware redirect).

## Talking points (architecture)

- Guest cart/order tokens hashed; raw tokens only in httpOnly cookies.  
- Order totals and stock reservation run in Postgres RPCs (atomic).  
- Admin catalog uses **service role server-side only**; storefront uses **anon + RLS**.  
- Deploy: **Vercel (app) + Supabase (DB)** free tiers — not Render for the storefront.

## Reset demo data

See [RUNBOOK.md](./RUNBOOK.md) — free project wipe via `supabase db reset --linked` only when data loss is OK.
