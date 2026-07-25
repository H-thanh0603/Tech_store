# Hosting decision: Vercel vs Render

## Recommendation for TechStore

**Use Vercel for the Next.js app. Use Supabase for the database. Do not use Render for the storefront in M6.**

```
Browser → Vercel (Next.js App Router)
              ↓ anon key / service role (server only)
         Supabase Cloud (Postgres + RLS + RPC)
```

## Comparison

| Criterion | Vercel | Render |
|-----------|--------|--------|
| Next.js App Router | Native, zero-config | Node web service / Docker; more setup |
| Middleware / Edge | First-class | Limited / different model |
| `next/image` | Optimized on platform | Self-host or disable optimisations |
| Preview deploys | Automatic per PR | Manual / extra service |
| Free tier fit | Hobby + GitHub import | Free web services sleep (cold start) |
| Best for this repo | **Yes** | Background workers later, not storefront |

## When Render would make sense later

- Long-running worker (queue consumer, PDF job)
- Non-Next API in Docker
- Need always-on process that is not serverless-friendly

For a pure Next.js storefront + admin demo, Render adds cold starts and image config without benefit.

## Supabase (not optional in this architecture)

Local Docker Supabase is for development. Production/demo cloud project receives the same migrations under `supabase/migrations/`.
