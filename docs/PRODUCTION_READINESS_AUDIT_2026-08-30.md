# PRODUCTION READINESS AUDIT — TechStore

**Ngày audit:** 2026-08-30 · **Commit:** `d8e4d8b` (main, clean tree)
**Phạm vi:** toàn bộ repo — 36 SQL migrations, ~50 API route/server-action module, 42 unit test files, 21 pgTAP files, 4 GitHub workflows, docs/ops.
**Phương pháp:** 5 luồng audit song song (Database, Backend/API, Security, Frontend, DevOps/Reliability) + xác minh thủ công từng phát hiện P0/P1 trực tiếp trên code. Mọi kết luận dưới đây đều trích dẫn file cụ thể.

---

## 1. Executive Summary

TechStore là một dự án **được xây dựng với kỷ luật kỹ thuật hiếm thấy ở quy mô này**: RLS trên 100% bảng, transactional outbox có claim-based drain, idempotency key ở DB, khóa `FOR UPDATE` đúng thứ tự chống oversell, VNPay verify HMAC + amount re-check trong DB, admin AAL2/TOTP bắt buộc server-side, CSP nonce, 42 unit test + 21 pgTAP + e2e, và docs/ops trung thực đến mức tự liệt kê đúng những điểm yếu của chính mình.

**Nhưng audit này tìm thấy 2 nhóm vấn đề P0 mà chính hệ thống CI không thể phát hiện:**

1. **Migration `202608270002_shipping_rates.sql` là một "landmine"**: nó tạo overload 5-tham-số của `place_order_internal` tham chiếu các object **không tồn tại** (`carts.expires_at`, kiểu `order_status` enum, cột `orders.province/district/ward`), đồng thời **ghi đè `order_get_by_access` từ SECURITY DEFINER thành SECURITY INVOKER** — trong khi `orders`/`order_items` không có grant nào cho anon/authenticated. Hệ quả trực tiếp, đã xác minh: **trang xác nhận đơn hàng và trang chi tiết đơn của khách vãng lai sẽ lỗi 404 trong production** (`app/(storefront)/orders/[code]/confirmation/page.tsx:40` → `notFound()`; caller `lib/commerce/queries.ts:120`). CI xanh là ảo: pgTAP chạy dưới quyền `postgres` (owner, bypass RLS) nên không thấy khác biệt definer/invoker, và e2e `smoke.spec.ts:151` chỉ assert **URL**, không assert nội dung trang.
2. **Lưới an toàn vận hành (backup, monitoring, alert) hiện không hoạt động**: 6 secrets production chưa được add (tự thừa nhận trong `docs/ops/BACKLOG.md` §A), và job backup tuần trong `monitor.yml` có điều kiện `if` **không bao giờ đúng** với schedule của workflow (chi tiết OPS-001) — tức RPO thực tế = ∞.

**Kết luận ngắn:** *Chưa thể đưa lên production ngay* — nhưng khoảng cách rất ngắn. Sau khi sửa 2 P0 trên và ~10 P1, hệ thống đủ sức vận hành một cửa hàng quy mô nhỏ thật.

---

## 2. System Architecture Overview

```
Browser ── Cloudflare (documented, chưa wire) ── Vercel Hobby (region sin1, Next.js 16)
                                                    │  proxy.ts: session refresh + CSP nonce
                                                    │  ISR (revalidate 60s) cho /, /products/[slug]
                                                    │  Server Components gọi thẳng Supabase (anon key)
                                                    │  Server Actions → RPC Postgres
                                                    │  Cron 5 routes (CRON_SECRET) → RPC batch
                                                 Supabase Cloud (Postgres, 1 region)
                                                    ├─ RLS 100% bảng; business logic trong SECURITY DEFINER RPC
                                                    ├─ Transactional outbox (notification_outbox) → Resend
                                                    ├─ request_rate_limits (fixed-window, table-based)
                                                    ├─ Storage: product-images (public read, 10MB, MIME allowlist)
                                                    └─ analytics_events / admin_audit_logs (retention cron)
```

**Đánh giá kiến trúc:** modular monolith một-repo, phân lớp rõ: `app/` (route) → `lib/{commerce,catalog,content,admin,customer}` (logic + DTO) → RPC Postgres (business-critical + authz). Dependency direction đúng, không có circular import đáng kể. Business logic tiền-bạc được đẩy xuống DB transaction là **lựa chọn đúng** cho đơn hàng/tồn kho. Không có single point of failure nào do code — mọi SPOF đều đến từ nền tảng free-tier (Vercel 1 region, Supabase 1 project).

Điểm yếu kiến trúc duy nhất đáng kể: **view `catalog_products` tính 7 correlated subqueries mỗi row** (giá min, tồn khả dụng reservation-aware, has_discount…) và bị PostgREST truy vấn trực tiếp từ storefront — đây sẽ là hot-spot đọc đầu tiên khi catalog lớn (DB-022).

## 3. Production Readiness Score

| Category | Score /10 | Severity | Ghi chú chính |
|---|---:|---|---|
| Architecture | 8 | 🟢 | Layering chuẩn; hot-spot duy nhất là catalog view |
| Backend/API | 7 | 🟡 | Idempotency/validation tốt; rate-limit identity bypassable |
| Frontend | 7 | 🟡 | ISR kỷ luật; pagination render toàn bộ số trang; `revalidate=60` chết trên /products |
| Database | 6.5 | 🟠 | Schema/constraints xuất sắc; migration hygiene vỡ (P0); thiếu index `orders.created_at` |
| Scalability | 5.5 | 🟠 | Free-tier 1 region; không cache cross-request; OFFSET mọi list RPC |
| Security | 7.5 | 🟡 | AAL2/CSP/RLS/secret hygiene tốt; thiếu HSTS; admin login chưa rate-limit |
| Performance | 6.5 | 🟡 | `count:'exact'` lãng phí; per-row subquery trong view/recommend |
| Reliability | 6 | 🟠 | Cron design tốt nhưng đang không chạy; phụ thuộc platform |
| Data integrity | 8 | 🟢 | Lock ordering, state machine, floor trigger — gần như textbook |
| Testing | 7 | 🟡 | Độ phủ rộng; mù definer-vs-invoker; thiếu e2e return/CSV/bulk |
| DevOps | 6 | 🟠 | CI tốt; không staging; preview dùng DB prod; cron vượt limit Hobby |
| Observability | 5 | 🟠 | Có Sentry nhưng không release/sourcemap; không request-id |
| Disaster recovery | 4.5 | 🔴 | Backup không tự chạy; storage objects không backup; restore-to-Supabase chưa test |
| Maintainability | 7 | 🟡 | Docs rất tốt; migration churn là nợ chính |

### **Overall Production Readiness Score: 65/100**

---

## 4. Critical Issues — P0

### P0-1 — Migration `202608270002_shipping_rates.sql` ghi đè hàm thanh toán/truy cập đơn bằng bản tham chiếu schema không tồn tại
**Component:** Database · **Location:** `supabase/migrations/202608270002_shipping_rates.sql:60-214, 217-250`
**Problem:** (đã xác minh từng dòng trên code)
- Dòng 60: tạo overload `place_order_internal(p_cart_token_hash, p_order_access_token_hash, p_customer, p_payment_method, p_coupon_code)` — 5 tham số, trong khi wrapper `place_order` gọi bản 7-tham-số từ `202608250012`. Bản 5-tham-số tham chiếu: `carts.expires_at` (bảng carts chỉ có status/token_hash/applied_coupon_id — đã kiểm tra `202607240003:40-48`), cast `'pending'::order_status` (không có enum type nào trong toàn bộ migrations — `grep "create type"` = 0 kết quả), `orders.province/district/ward/street_address/status` (orders dùng `address_snapshot jsonb` + `order_status`), `inventory_reservations.cart_id` (bảng có `order_id`). Migration áp dụng thành công vì Supabase CLI chạy với `check_function_bodies = off` — tức lỗi chỉ nổ **lúc runtime nếu có ai gọi**. Đây là dead code nghiêm trọng vì nó "trông giống" bản thật và sẽ nuốt bất kỳ ai edit sau này; tệ hơn, nó *release reservations theo cart* — nếu được gọi sẽ phá whole mô hình chống oversell.
- Dòng 217: `order_get_by_access` đổi từ SECURITY DEFINER (`202608240004`) thành `LANGUAGE sql STABLE` invoker thường, **không có grant SELECT trên `orders`/`order_items` cho anon/authenticated** (revoked tại `202607240003:170-186`, đã grep toàn bộ migrations — không migration nào grant lại).
- Dòng 33-57: `calculate_shipping` invoker + `shipping_rates` có RLS policy nhưng **quên `grant select`** → tính phí ship cho storefront trả null.

**Why it matters / How it fails:** Khách đặt hàng COD thành công → redirect `/orders/{code}/confirmation` → server component gọi RPC bằng anon key → PostgreSQL từ chối SELECT trên `orders` (permission denied dưới invoker rights) → `notFound()` (`confirmation/page.tsx:40`). Trang chi tiết đơn tương tự (`lib/commerce/queries.ts:120` → dùng ở `app/(storefront)/orders/[code]/page.tsx`). **Luồng mua hàng lõi gãy đúng bước cuối cùng.**
**Why CI không thấy:** pgTAP chạy với role `postgres` = table owner (invoker vẫn đọc được); không test nào gọi `order_get_by_access` (grep `supabase/tests/` = 0); e2e chỉ assert URL (`e2e/smoke.spec.ts:151,158`).
**Recommended solution:** Migration forward-fix: (1) `DROP FUNCTION place_order_internal(text,text,jsonb,text,text)`; (2) khôi phục body `order_get_by_access` SECURITY DEFINER + `set search_path = public, pg_temp` từ `202608240004`; (3) `calculate_shipping` thành SECURITY DEFINER + `grant select on shipping_rates to anon, authenticated`; (4) thêm pgTAP test gọi `order_get_by_access` **dưới `set local role anon`**; sửa e2e assert nội dung trang confirmation (text "Đặt hàng thành công").
**Effort:** Low (½ ngày). **Priority: P0.**

### P0-2 — Lưới an toàn vận hành không hoạt động: backup không bao giờ tự chạy, monitoring/alert chưa được cấp secrets
**Component:** DevOps/DR · **Location:** `.github/workflows/monitor.yml`, `docs/ops/BACKLOG.md` §A
**Problem:**
- Job backup trong `monitor.yml` gate trên `github.event.schedule == '0 3 * * 1'` nhưng schedule duy nhất của workflow là `*/15 * * * *` → điều kiện **không bao giờ đúng** → `supabase db dump` + restore-proof + row-count compare **không bao giờ chạy tự động** (chỉ khi manual dispatch). RUNBOOK tuyên bố có backup tuần — sai với thực tế.
- 6 secrets production (`PROD_BASE_URL`, `SUPABASE_DB_URL`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN/CHAT_ID`) chưa add → toàn bộ monitor/RLS-smoke/Telegram/lighthouse skip hoặc đỏ.

**Why it matters:** Hệ thống bán hàng, giữ tiền, mà mất DB hôm nay = mất dữ liệu đơn hàng vĩnh viễn. RPO thực tế = ∞.
**Recommended solution:** (1) Tách backup thành workflow riêng với cron riêng `0 3 * * 1`; (2) add 6 secrets theo checklist FREE_TIER_HARDENING; (3) chạy 1 lần workflow_dispatch để chứng minh pipeline xanh end-to-end; (4) công bố RPO ≤ 7 ngày / RTO mục tiêu trong RUNBOOK.
**Effort:** Low. **Priority: P0** (bắt buộc trước khi có đơn hàng thật đầu tiên).

---

## 5. High Priority Issues — P1

### DB-020 — Không có index `orders.created_at` — mọi dashboard/list admin seq-scan
**Location:** `supabase/migrations/202607240003` (orders), query tại `202607250010_admin_dashboard.sql:45-71`, `202608250013:38-79`.
Dashboard KPI lọc theo `created_at` 4 lần mỗi lần load, `admin_list_orders` sort `created_at desc` + `count(*) over()`. Ở 10M orders: full scan + sort mỗi page admin. **Fix:** `create index orders_created_at_idx on orders (created_at desc)` (optionally `include (total, order_status)`). Effort: Low.

### DB-010 — Rate limit của `place_order` khóa vào cart token do client sinh → bypass hoàn toàn
**Location:** `202608240007_checkout_trust_boundary.sql:48-56`, `202608250012:52-60`.
Attacker script checkout bằng cách rotate token 64-hex tự sinh → không bao giờ chạm limit 5/15min; mỗi lần vẫn tiêu một lượt lock inventory + tạo cart row. **Fix:** thêm bucket theo IP hash (server-side, như `order_track` đã làm với `p_identity_hash`). Effort: Low-Medium.

### DB-040 — `notification_outbox` không có retention
**Location:** `202608290003_log_retention.sql` chỉ purge 3 bảng (audit 180d, analytics 90d, rate-limit 2d). Outbox mọc vô hạn (~700k rows/năm ở 1k đơn/ngày); index partial chỉ phủ pending/processing nên rows sent/failed là dead weight. **Fix:** thêm purge `sent/skipped` > 30 ngày vào `purge_expired_logs`. Effort: Low.

### OPS-002 — 4 cron jobs với schedule `*/5` rất có thể vượt limit Vercel Hobby (2 cron jobs)
**Location:** `vercel.json`, khóa cứng bởi `tests/ops/vercel-config.test.ts`.
Đây là **duy nhất một** free-tier limit team chưa document. Mitigated một phần bởi `/api/cron/health` chạy inline 2 task quan trọng mỗi 15 phút — nhưng abandoned-carts và purge-logs không có compensation inline (OPS-017). **Fix:** kiểm chứng hành vi thật sau deploy; nếu bị chặn → external scheduler (cron-job.org) hoặc gộp schedule. Effort: Low.

### FE-101 — Pagination render MỌI số trang → HTML nổ theo số sản phẩm
**Location:** `components/commerce/pagination.tsx:19` — `Array.from({length: pageCount})`. 1M products ÷ 12/page ≈ 83.000 link trong mỗi listing page. **Fix:** windowed pagination (current ±2 + ellipsis). Effort: Low.

### FE-201 — `revalidate = 60` trên `/products` chết hoàn toàn
**Location:** `app/(storefront)/products/page.tsx:25,32` — đọc `searchParams` ⇒ route dynamic per-request; facets/nav không có `unstable_cache` nào (grep = 0 hit repo-wide). Mọi request filter/sort/page re-run products query (`count:'exact'`) + facets + 3 content queries. Đây chính là nơi traffic tập trung. **Fix:** `unstable_cache` cho facets (TTL 60-300s, tag-based invalidation); xem xét PPR. Effort: Medium.

### API-001 — Thanh toán VNPay thành công sau khi order hết hạn = mất tiền khách, không có refund path
**Location:** `lib/commerce/vnpay-callback.ts:60-62`, `202608240006:53-55`. IPN trả `ORDER_EXPIRED` → VNPay đã trừ tiền khách nhưng hệ thống từ chối ghi nhận, không có refund tự động nào (chỉ admin ghi chú `refund_amount` tay). **Fix:** với callback signature-valid + `vnp_TransactionStatus=00` + `ORDER_EXPIRED`: tự reopen order (gia hạn expiry + mark paid) hoặc enqueue refund task vào outbox + alert ops. Effort: Medium.

### OPS-003 — Vercel Preview dùng chung Supabase production
**Location:** `docs/ops/DEPLOY.md` §4 — PR preview "share the free project". E2E/seed của PR có thể mutate dữ liệu đơn thật. **Fix:** dự án Supabase thứ 2 (free) cho preview env. Effort: Low.

### SEC-001/SEC-002 — Thiếu HSTS; admin login không có rate limit ứng dụng
**Location:** `next.config.ts:26-42` (không có Strict-Transport-Security anywhere), `lib/admin/auth-actions.ts:11-42` (`adminLogin` gọi thẳng `signInWithPassword`, không `check_rate_limit` — trong khi customer login có). **Fix:** thêm HSTS header; `check_rate_limit('admin_login', email+IP, 5, 15)`. Effort: Low.

### DB-021 — Các RPC list admin: OFFSET pagination + `ILIKE '%…%'` không index, `admin_list_customers` GROUP BY toàn bảng orders
**Location:** `202608250013`, `202607250011`. Đặc biệt `admin_list_customers` group toàn bộ orders mỗi lần xem page kể cả không search. **Fix:** trigram GIN trên cột được search (hoặc search `name_nd`), keyset pagination cho orders/audit, bảng summary per-phone cho customers. Effort: Medium.

## 6. Medium Issues — P2

| ID | Vấn đề | Location | Fix |
|---|---|---|---|
| DB-022 | `catalog_products` view: 7 correlated subqueries/row (stock reservation-aware per variant) exposure trực tiếp cho PostgREST; không thể index view | `202607240003:222-280` | Bảng `product_price_summary` trigger-maintained, hoặc cache TTL |
| DB-023 | `recommend_products` aggregate TOÀN BỘ `order_items` + `product_reviews` mỗi lần PDP view, granted cho anon | `202608240001:90-157` | Counter trigger-maintained trên products; giới hạn theo category |
| DB-051 | `check_rate_limit` granted cho anon/authenticated — abuse primitive: burn bucket người khác, bloat bảng với action name tùy ý | `202608290002:51` | Revoke from public; allow-list action; gọi từ server |
| API-007 | `applyCoupon` không rate limit nào → brute-force mã giảm giá; auth rate limit chỉ theo email (không IP) | `lib/commerce/actions.ts:100-106` | Thêm bucket cart-token+IP |
| API-009/010/011 | `/api/analytics/events` (service-role writes, unbounded flood), `/api/catalog/suggest` (`count:'exact'` per keystroke), `/api/account/export` (heavy, unthrottled, leak error.message) | `app/api/...` | IP limiter + origin check; `head:true`; throttle export |
| SEC-004 | Content/image/category/brand mutations không được audit-log (banner bị deface = không dấu vết) | `lib/admin/content-actions.ts`, `image-upload-actions.ts`, `catalog-actions.ts` | Thêm `writeAudit` theo pattern `product-actions.ts:48-66` |
| DB-041 | Retention deletes unbatched + không index trên `received_at`/`created_at` của bảng bị purge | `202608290003` | Index + batched delete loop (idiom `skip locked` đã có sẵn) |
| DB-044/DB-042 | Carts không purge; retention phụ thuộc cron bên ngoài thật sự chạy | `202608290003` | Thêm purge open carts idle > 90d; assert cron trong health |
| FE-401 | `dangerouslyAllowSVG: true` toàn cục cho image optimizer | `next.config.ts:16-19` | Bỏ khi seed dùng ảnh raster thật |
| FE-501 | Sitemap cap 240 product URLs + 20 fetch tuần tự mỗi lần regenerate | `app/sitemap.ts:39` | Query page-size 1000; `generateSitemaps` khi > 50k |
| FE-701 | Không có error boundary cho storefront/admin segment; root error drop toàn bộ layout | `app/error.tsx` | Thêm `app/(storefront)/error.tsx`, `app/admin/error.tsx` + `error.digest` |
| OPS-004 | Sentry không có `release`, không sourcemap upload → stack trace minified vô dụng | `sentry.*.config.ts` | Release = git SHA + sourcemap pipeline |
| OPS-009 | Không structured logging / request-id correlation — không thể truy vết 1 order failure xuyên logs | `lib/logger.ts`, `proxy.ts` | Sinh requestId ở proxy, đưa vào logger context |
| SEC-007/008 | Image upload: MIME client-declared, extension không sanitize; `deleteProductImage(path)` nhận path tùy ý | `lib/admin/image-upload-actions.ts:21-66` | Extension derive từ validated type; regex-validate path |

## 7. Low Priority Issues — P3

- **API-006:** `IDEMPOTENT_REPLAY` hiện generic error thay vì redirect về đơn đã có (RPC đã trả orderCode sẵn) — `lib/commerce/actions.ts:156-159`.
- **API-003:** VNPay signature check ký trên giá trị decoded; giá trị chứa `+`/space có thể verify fail oan → encode lại `encodeURIComponent` trước khi build check-string.
- **API-012/SEC-009:** CSV export thiếu formula-injection neutralization (`=`,`+`,`-`,`@` prefix) — `app/api/admin/audit/export/route.ts:10-15`.
- **API-014/SEC-012:** Cron secret so sánh không timing-safe (dùng `timingSafeEqual` như `lib/commerce/vnpay.ts:52` đã có sẵn).
- **API-013:** CSP report không thật sự tới Sentry (logger chỉ là console); thiếu body cap + rate limit.
- **SEC-003:** MFA verify không rate limit app-level. **SEC-011:** signup leak raw "User already registered" (enumeration oracle). **SEC-013:** rate limit auth thiếu IP → targeted lockout victim. **SEC-014:** magic-link `shouldCreateUser: true` → pre-hijack surface.
- **DB-014:** `admin_decide_return` reject path luôn trả order về `completed` kể cả khi return request từ `shipping`.
- **DB-011:** `request_order_return` concurrent duplicate → unique_violation leak 500 thay vì jsonb code.
- **FE-104:** LCP image thiếu `priority`; **FE-301:** recharts import tĩnh trong admin; **FE-801:** filter drawer click-into-content tự đóng + thiếu focus trap; **FE-1001:** Lighthouse throttling quá nhẹ (40ms/10Mbps thay vì 150ms/1.6Mbps).
- **OPS-007/008:** Cron errors không capture Sentry; **OPS-014:** comment/code mismatch trong health route; **OPS-016:** CI thiếu `concurrency` group; mobile Playwright project không chạy trong CI.
- **DB-052:** `product_restock_requests` — anon insert không limit → spam waitlist + email bơm địa chỉ tùy ý khi restock.
- **DB-026/DB-024:** `pickup_stores_for_cart`/`admin_sales_funnel` — ok hiện tại, cần revisiting khi scale.

---

## 8. Architecture Review

Điểm mạnh: server-first, DB là source of truth cho mọi business-critical write; `lib/` tách domain sạch; không có god-module; outbox pattern đúng chuẩn; DTO typed boundaries.
Cần cải thiện: (1) `catalog_products` view đang làm quá nhiều việc per-row — tách summary table; (2) 3 implementation khác nhau của cùng 1 rate-limiter (inline `place_order`, inline `order_track`, `check_rate_limit`) — consolidate; (3) migration hygiene là nợ kiến trúc lớn nhất: `202608250011` từng regress `place_order` (mất vnpay/validation), `202608270002` là landmine hiện tại — quy trình "không được sửa migration đã apply, chỉ forward-fix" đã document nhưng **không có gate tự động** (OPS-020).
Không cần microservices ở mọi quy mô dự kiến; modular monolith hiện tại là đúng.

## 9. Database Review

Schema: UUID PK đúng chỗ cần, bigint identity cho `analytics_events` (đúng), FK/constraint coverage xuất sắc (CHECK `total = subtotal - discount + shipping`, `line_total = unit_price * quantity`, jsonb size caps, token-hash length). Denormalization có chủ đích (`order_items.product_name/sku`, `coupon_snapshot`).
Index: chi tiết trong DB-020/021/040. Partial indexes mirror RLS predicates — rất tốt.
Pagination: **không có keyset pagination nào trong toàn bộ project** — storefront chịu chi phí qua view (DB-022), admin qua OFFSET (chấp nhận được với back-office).
Concurrency & race conditions: **đã kiểm tra kỹ — phần lớn được bảo vệ tốt** (xem §15). Các lỗ còn lại: DB-010 (rate-limit identity), DB-011 (unique_violation 500), DB-014 (return-reject status).
Data growth: bảng lớn nhất = `analytics_events` → `notification_outbox` → `orders/order_items`. Retention có cho 3/5; thiếu outbox + carts (DB-040/044). Partitioning chỉ cần khi > 50M rows (analytics trước tiên, `drop partition` thay delete).
**EXPLAIN cần chạy để xác nhận** (không thể kết luận từ source): `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM admin_list_orders(...)` trên dataset ≥ 1M orders; `EXPLAIN ANALYZE SELECT * FROM catalog_products WHERE ... ORDER BY min_price DESC LIMIT 12`; `EXPLAIN ANALYZE SELECT recommend_products(...)` trên 10M order_items. Chưa benchmark = chưa khẳng định con số cụ thể nào.

## 10. Backend/API Review

Điểm nổi bật: VNPay amount integrity kín (DB-computed → HMAC → re-check `orders.total*100` dưới `FOR UPDATE` + `payment_ref` unique partial index); idempotency end-to-end (DB unique key → cart-status guard → outbox `Idempotency-Key` header); error mapping whitelist (`isCommerceErrorCode`) không leak nội bộ (trừ 3 route liệt kê ở API-011/014).
Điểm yếu: rate limiting thiếu ở coupon/analytics/suggest/export/admin-login; rate-limit identity client-controlled (DB-010); email luôn qua outbox (đúng) — checkout không bao giờ block bởi Resend (verified: `notify.ts` chỉ chạy trong cron).

## 11. Frontend Review

Nền tảng rất tốt: ISR kỷ luật có comment giải thích, hydration-safe localStorage (`useSyncExternalStore` + stable server snapshot + cross-tab sync — textbook), search-param boundary tập trung có test, a11y tốt hơn trung bình đáng kể (combobox chuẩn, focus trap e2e).
Sửa trước khi scale: FE-101 (pagination), FE-201 (caching chết), FE-102/103 (unbounded `page`/`q`), FE-701 (error boundaries).

## 12. Security Review

Điểm mạnh (đã verify): AAL2 re-derive server-side mỗi request (`lib/admin/auth.ts:56-82`), mọi admin server action đều có gate — không tìm thấy action nào thiếu authz; admin RPC `revoke from public + grant service_role only` ở SQL level; secret hygiene tốt (`.env.local`/`.admin-e2e-mfa-secret` chưa từng vào git history); JSON-LD escape `<`; `safeHref` chặn `javascript:`; không dynamic SQL string building.
Cần sửa: SEC-001 (HSTS), SEC-002 (admin login RL), SEC-004 (audit gap content/image/catalog), SEC-006 (product detail page chỉ check authenticated, không check module — staff thấy form product edit; mutation vẫn bị chặn), SEC-009 (CSV formula injection), DB-050 (anon đọc exact `inventory.quantity`), DB-051 (`check_rate_limit` public grant).

## 13. Scalability Review — Growth Simulation

| Scale | Hiện trạng | Bottleneck đầu tiên | Cần thay đổi |
|---|---|---|---|
| **1K users** (100 rps, 10k products) | OK free-tier | Supabase free CPU khi `/products` dynamic (FE-201) | Fix P0 + FE-201; vẫn free tier |
| **10K users** (1k rps, 100k products) | 🟠 cần hardening | catalog view per-row subquery + `count:'exact'` mỗi filter request; mỗi request còn 6+ DB round-trips (facets/nav) | Summary table cho view; cache facets; external scheduler cho cron; Vercel Pro + Supabase paid (pooler, PITR) |
| **100K users** (5k rps) | 🔴 không đủ | Postgres đơn region; OFFSET listing; recommend_products full-aggregate mỗi PDP | Read replica; CDN cho catalog HTML; keyset pagination; queue cho email/notify tách khỏi DB limiter; pre-aggregate analytics |
| **1M users** (10k rps, 100M records) | 🔴 cần re-architecture | DB write throughput; search; storage | Partition analytics/outbox; dedicated search engine (Meilisearch — hỗ trợ Vietnamese diacritic-insensitive tốt); multi-region; object storage + CDN cho ảnh |

Không thể khẳng định hệ thống chịu được con số rps nào nếu chưa load test — cần k6 với scenarios ở §22.

## 14. Performance Review

N+1: không tìm thấy ở app layer (server components fetch flat/parallel có `Promise.all` + `cache()`); N+1 nằm ở **SQL layer** (DB-022/023/026).
Lãng phí đo được: `count:'exact'` cho mỗi suggest keystroke + mỗi listing request; 20 fetch tuần tự trong sitemap; recharts static import admin.
Lighthouse gate ≥ 80 đã có trong CI nhưng (a) chưa từng chạy (BACKLOG D2), (b) throttling profile nhẹ hơn thật tế VN mobile 10×.

## 15. Concurrency & Race Condition Review

**Đã được bảo vệ tốt (verify từng SQL):** oversell (lock toàn bộ inventory rows theo thứ tự variant_id trong `place_order_internal` + reservation-aware availability + DB floor trigger `202608240005`), coupon double-spend (`FOR UPDATE` coupon + `unique(coupon_id, order_id)`), double-submit (idempotency key unique + cart-status), VNPay replay (unique payment_ref + amount check), cron overlap (`FOR UPDATE SKIP LOCKED` + claim tokens + stale-claim recovery), deadlock (lock ordering deterministic).
**Lỗ hổng còn lại:** DB-010 (bypass rate limit), DB-011 (500 thay vì jsonb code khi 2 request return đồng thời), lost-update không tìm thấy ở luồng nào; optimistic locking chưa cần vì mọi mutation đi qua definer RPC có lock.

## 16. Reliability Review

- **DB down 30s:** storefront ISR pages vẫn serve (cached HTML); `/products` + cart/checkout fail → error boundary; cron route fail; health 503 đúng thiết kế. Khách đang checkout mất cart session? Cookie giữ nguyên, retry OK.
- **Resend down:** outbox giữ `pending`, retry backoff 1→16m ×5 → `failed`; order không bị ảnh hưởng. Tốt. Thiếu: `AbortSignal.timeout` (API-014 treo cron slot).
- **Supabase Auth chậm:** `proxy.ts` `updateSession` gọi `getUser()` trên **mọi request kể cả /api/** — coupling availability đáng cân nhắc (thu hẹp matcher).
- **Deploy bug:** rollback = Vercel promote last good (documented); DB = forward-fix only (documented); nhưng **không có gate chặn deploy khi migration chưa apply** (OPS-020) — drift chỉ phát hiện 15 phút sau.
- **Server crash giữa transaction:** Postgres原子性 đảm bảo; outbox chưa-gửi sẽ được claim lại sau stale-claim timeout 10 phút. Đúng.

## 17. Data Integrity Review

Constraint coverage gần như kín. Hai điểm: DB-014 (return-reject hard-code `completed`), SEC-013/GDPR (erasure giữ `customer_name/phone/address_snapshot/note` trên orders — cần cơ sở lưu giữ được document). Orphan records: không tìm thấy đường đi (FK `restrict` + delete-blocking trigger cho product đã bán).

## 18. Testing Review

42 vitest files (~241 tests) phủ validation/logic; 21 pgTAP (~180 asserts) phủ schema/RLS/state machine; e2e 30 tests gồm full purchase journey. **Lỗ hổng cấu trúc:** pgTAP chạy dưới owner → mù với definer/invoker + grant regressions (chính là P0-1); e2e assert URL thay vì nội dung ở 2 bước quan trọng nhất; thiếu e2e return/CSV/bulk (team tự nhận "regression risk cao nhất"); không load test và chưa có trigger document khi nào cần.

## 19. DevOps / Deployment Review

CI app+database jobs chất lượng cao (local-only keys trong PR path — hygiene tốt). Deploy manual, không staging, preview = prod data (OPS-003), migration apply manual + drift check 15-min sau sự kiện (OPS-020). Developer mới clone repo: **setup đáng tin cậy** (README + `supabase start` + seed script + MFA secret auto).

## 20. Observability Review

Sentry 3 runtimes + replay mask PII (tốt) nhưng thiếu release/sourcemap; logger JSON-ish console nhưng không request-id; web vitals ghi DB first-party nhưng **không ai đọc** (không dashboard/alert); cron errors không vào Sentry. Ưu tiên: release tracking + requestId correlation (OPS-004/009).

## 21. Backup & Disaster Recovery

Thiết kế pipeline tốt (dump → GitHub artifact + Storage bucket → restore-proof vào Docker + row-count diff) nhưng: chưa từng tự chạy (P0-2), restore-proof là vào Postgres thuần **không phải Supabase** (roles/extensions/RLS chưa được chứng minh), storage objects (ảnh sản phẩm) **không được backup**, chưa test restore lên project Supabase thứ 2. RPO/RTO chưa công bố.

## 22. Load Testing Plan (cần làm trước khi kết luận hiệu năng)

k6 scenarios đề xuất: (1) browse: 100 VU GET `/products?page=N` trong 5 phút — đo p95 + Supabase CPU; (2) filter storm: 50 VU random filter/sort combo; (3) suggest: 200 VU GET `/api/catalog/suggest?q=`; (4) checkout mix: 20 VU add→checkout COD trên local Supabase có **1M orders seed** — đo place_order p95 + lock contention; (5) spike: 0→500 VU trong 30s vào `/` (ISR) và `/products` (dynamic). Chạy trên dataset seed ≥ 1M products / 10M orders mới có ý nghĩa (seed hiện tại là catalog nhỏ).

## 23. Bottleneck Analysis (theo data growth)

| Thành phần | Nhỏ (hiện tại) | 1M records | 10M records | 100M records |
|---|---|---|---|---|
| `catalog_products` view | OK | min_price filter bắt quét toàn bộ + 7 subquery/row | không chấp nhận được | — |
| Admin list RPCs | OK | `orders.created_at` thiếu index đau rõ | OFFSET + ILIKE + full-table GROUP BY | — |
| `notification_outbox` | OK | không purge → vài trăm MB | đẩy DB free 500MB chết | — |
| `analytics_events` | OK | purge 90d giữ ổn định | cần partition + batched delete | partition bắt buộc |
| Search (FTS + trgm GIN) | OK | OK | OK (GIN scale tốt) | cần dedicated search engine |
| Images (Supabase Storage public) | OK | OK + CDN khuyến nghị | cần CDN + biến thể resize | cần media pipeline riêng |

## 24. Recommended Production Architecture

**Hiện tại → Small Production (ngay sau fix P0/P1):**
```
Cloudflare (DNS + CDN + WAF free) → Vercel Pro (sin1) → Supabase Pro (pooler + PITR + daily backup)
                                                     → Resend (paid khi > 3k emails/tháng)
Cron: giữ Vercel (sau khi xác minh limit) hoặc cron-job.org → 5 routes
Monitoring: external uptime ping (Better Stack free) → /api/health?check=db; Telegram alert (đã build)
```
**Chưa cần ở quy mô hiện tại:** Redis (chưa có cache-invalidation problem mà `unstable_cache` + ISR chưa giải quyết được — không thêm Redis chỉ vì "production nên có"), RabbitMQ/Kafka (outbox + Postgres SKIP LOCKED đủ cho hàng nghìn jobs/giờ), Elasticsearch (GIN trgm đủ tới vài triệu products), microservices, read replica (chỉ khi Supabase CPU là bottleneck đo được).

## 25. Migration Roadmap

**Phase 0 — Fix Critical (trước đơn hàng thật đầu tiên, ~2-3 ngày):**
P0-1 (migration landmine + order_get_by_access + shipping grants + pgTAP/e2e blind-spot fix) · P0-2 (tách backup workflow + add 6 secrets + chạy 1 lần chứng minh) · OPS-002 (xác minh cron Hobby) · HSTS + admin-login rate limit.

**Phase 1 — Production Hardening (1-2 tuần):**
DB-020 index · DB-040/DB-044 retention · DB-010 rate-limit IP · API-001 expired-payment recovery · SEC-004 audit gap · FE-101/FE-201 · API-007/009/010/011 throttles · OPS-004 Sentry release · OPS-009 request-id · staging Supabase project cho preview.

**Phase 2 — Scale (khi > 10k users hoặc > 5k SKUs):**
Summary table cho catalog view · keyset pagination admin · recommend pre-compute · external cron scheduler · load test suite k6 · Vercel Pro + Supabase paid.

**Phase 3 — Large Scale (khi benchmark chỉ ra DB là bottleneck):**
Read replica · partition analytics/outbox · dedicated search engine · CDN catalog HTML · media pipeline.

**Phase 4 — Future:** multi-region, refund automation VNPay, e-invoice MISA/Viettel (legal trigger), carrier APIs GHN/GHTK.

## 26. Final Production Verdict

### ❌ **NO — Chưa thể đưa lên production ngay hôm nay** (nhưng chỉ cách 2-3 ngày làm việc)

Lý do quan trọng nhất:
1. **Luồng mua lõi gãy ở bước cuối**: khách đặt hàng xong sẽ thấy 404 thay vì trang xác nhận (P0-1 — đã xác minh code từng dòng, CI mù với lỗi này). Đây là lỗi chức năng khách hàng thấy ngay, không phải hypothetical.
2. **Hệ thống giữ tiền mà không có backup tự chạy** (P0-2): dump pipeline build kỹ nhưng điều kiện `if` khiến nó không bao giờ fire; secrets chưa add khiến mọi safety net khác cũng tắt.
3. Điểm tích cực quyết định: **không tìm thấy P0 nào về mất tiền do race condition, oversell, double-charge** — phần khó nhất (inventory + payment + idempotency) đã đúng. Sau Phase 0, verdict chuyển thành **⚠️ YES — phù hợp production quy mô nhỏ**; sau Phase 1 → **🟡 Production-ready**.

## 27. Top 10 Things That Must Be Fixed First

1. P0-1a: Khôi phục `order_get_by_access` SECURITY DEFINER (`202608270002:217`)
2. P0-1b: Xóa overload 5-arg `place_order_internal` + sửa `calculate_shipping`/`shipping_rates` grants
3. P0-1c: Thêm pgTAP test `set local role anon` cho order-read RPCs; e2e assert nội dung confirmation
4. P0-2: Tách backup workflow + add 6 secrets + chạy chứng minh
5. OPS-002: Xác minh/fix Vercel Hobby cron limits
6. SEC-001 + SEC-002: HSTS + admin login rate limit
7. DB-020: Index `orders.created_at desc`
8. DB-040: Outbox retention
9. API-001: Expired-VNPay-payment auto-recovery/refund path
10. FE-201: Cache facets / sửa `revalidate` chết trên `/products`

---

## Phụ lục A — Bảng tổng hợp issue

| # | Vấn đề | Severity | Production Impact | Scalability Impact | Effort | Priority |
|---|---|---|---|---|---|---|
| 1 | Migration 202608270002 phá order_get_by_access + place_order landmine | 🔴 P0 | Khách thấy 404 sau khi đặt hàng | Chặn mọi env mới | Low | P0 |
| 2 | Backup không tự chạy + secrets thiếu | 🔴 P0 | Mất dữ liệu vĩnh viễn khi sự cố | — | Low | P0 |
| 3 | Cron vượt limit Vercel Hobby | 🟠 P1 | Reservation/email/purge không chạy | — | Low | P1 |
| 4 | Thiếu index orders.created_at | 🟠 P1 | Admin/dashboard chậm | Seq-scan ở 10M orders | Low | P1 |
| 5 | Rate-limit checkout khóa client token | 🟠 P1 | Abuse/DoS inventory locks | Bypass hoàn toàn | Low-Med | P1 |
| 6 | Outbox không retention | 🟠 P1 | DB phình | 500MB cap chết sớm | Low | P1 |
| 7 | VNPay paid-sau-expiry không refund | 🟠 P1 | Mất tiền khách, khiếu nại | — | Medium | P1 |
| 8 | Pagination HTML render mọi trang | 🟠 P1 | TTFB/LCP sụp | Nổ tuyến tính theo products | Low | P1 |
| 9 | revalidate /products chết, không cache facets | 🟠 P1 | DB load = traffic | Bottleneck đầu tiên | Medium | P1 |
| 10 | Preview dùng DB prod | 🟠 P1 | PR mutate dữ liệu thật | — | Low | P1 |
| 11 | Thiếu HSTS; admin login không RL | 🟠 P1 | Session hijack MITM; brute force | — | Low | P1 |
| 12 | Admin list OFFSET/ILIKE/full-agg | 🟡 P2 | Admin chậm dần | ~10M orders | Medium | P2 |
| 13 | catalog view per-row subquery | 🟡 P2 | Storefront chậm | ~100k products | Medium | P2 |
| 14 | recommend full-aggregate per PDP | 🟡 P2 | PDP chậm | ~10M order_items | Medium | P2 |
| 15 | Coupon/analytics/suggest/export thiếu throttle | 🟡 P2 | Abuse, log-flood | Bloat DB | Low | P2 |
| 16 | Content/image mutations không audit | 🟡 P2 | Không truy vết được | — | Low | P2 |
| 17 | Sentry không release/sourcemap; không request-id | 🟡 P2 | Debug production khó | — | Medium | P2 |
| 18 | check_rate_limit public + inventory.quantity public | 🟡 P2 | Abuse primitive, lộ tồn kho | — | Low | P2 |
| 19 | CSV formula injection; image upload hardening | 🟢 P3 | Excel pivot attack | — | Low | P3 |
| 20 | e2e thiếu return/CSV/bulk; Lighthouse chưa chạy | 🟢 P3 | Regression risk | — | Medium | P3 |

## Phụ lục B — Điểm sáng (giữ nguyên, đừng phá khi refactor)

1. Oversell prevention: deterministic `FOR UPDATE` ordering + reservation-aware availability + floor trigger (`202608240005`).
2. VNPay integrity: DB-computed amount → HMAC (`timingSafeEqual`) → re-validate trong RPC dưới lock + `payment_ref` unique.
3. Transactional outbox với claim tokens + stale-claim recovery — production-grade queue, không cần Redis/BullMQ.
4. RLS 100% bảng; commerce tables zero-policy + explicit revoke; mọi business RPC SECURITY DEFINER `set search_path = public, pg_temp`.
5. Admin AAL2/TOTP re-derive server-side mỗi request; permission matrix tập trung.
6. Token hygiene: 256-bit cart tokens, chỉ lưu SHA-256, rotate sau conversion.
7. Idempotency end-to-end checkout → payment → email.
8. Test culture: 241 unit + 180 pgTAP + 30 e2e + schema contract check sinh ra từ một P0 thật.
9. Health check phân biệt liveness/readiness, phát hiện đúng Supabase free-tier pause.
10. Ops docs trung thực hiếm thấy (RUNBOOK rollback, FREE_TIER_HARDENING upgrade triggers, BACKLOG tự khai khuyết điểm).
