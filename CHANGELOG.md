# Changelog

## 2026-09-14 — Production-readiness fix batch
- Reliability: `app/error.tsx` cải thiện + Sentry, thêm `app/global-error.tsx`, `app/not-found.tsx`; `lib/logger.ts` forward error → Sentry + `requestId` explicit; Resend fetch timeout 15s; carrier quote timeout 8s + retry 1 lần + fallback internal.
- Security: auth rate-limit key `email:ip` + log fail-open; coupon fail-open có log.
- DevOps: `alert-on-failure.yml` watch CI/Monitor/Backup/Lighthouse/RLS; migration `202609140001` thêm index `orders(user_id,created)`, `order_items(variant_id)`.
- Docs: fix cron STAGING `0 6 + 0 18`; thêm `ADMIN_GUIDE/API/DATABASE/BACKUP/TROUBLESHOOTING/CHANGELOG`.
