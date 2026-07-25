# TechStore M6 Launch-ready Design

Date: 2026-07-25  
Status: Approved  
Scope: M6 Launch-ready demo — free-tier deploy, seed/demo ops, runbook + rollback

## Platform decision

| Layer | Choice | Why |
|-------|--------|-----|
| **App (Next.js 16)** | **Vercel free hobby** | First-class Next.js App Router, zero Docker, preview deploys, env UI |
| **Database** | **Supabase free** | Already in stack (Postgres + RLS + RPC); cloud project mirrors local migrations |
| **Not chosen: Render** | — | Fine for Docker/Node services; weaker DX for App Router/image/middleware vs Vercel. Keep optional for future workers only. |

Do **not** dual-deploy the storefront on both Vercel and Render.

## Deliverables

1. `vercel.json` — project metadata / framework hint  
2. `app/api/health` — uptime probe (no secrets)  
3. `docs/ops/DEPLOY.md` — Vercel + Supabase free-tier steps  
4. `docs/ops/RUNBOOK.md` — day-2 ops, incidents, rollback  
5. `docs/ops/DEMO.md` — demo script + seed coupons / admin secret guidance  
6. README — platform decision + deploy pointers  
7. `.env.example` — production-oriented comments  

## Out of scope

- Actually provisioning the user's Vercel/Supabase accounts (requires human login)
- Custom domain purchase
- Paid tiers, CDN multi-region, monitoring SaaS beyond free
- Render Blueprint (not selected)

## Success

- Repo is deployable by following DEPLOY.md alone  
- Health route builds and returns 200  
- Rollback steps documented and reversible (Vercel promote + Supabase migration discipline)
