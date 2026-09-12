# BACKLOG — những thứ còn thiếu, ghi rõ trước khi vận hành thật

Tất cả những gì đã được ghi nhận là "giới hạn" hoặc "chưa làm" trong code
session 2026-08-29 → 08-30. Mỗi mục: tại sao chưa làm, làm khi nào, và
chìa khóa mở (nếu có).

## 0. ĐÃ FIX (2026-08-30, audit production readiness)

Hai P0 trong `docs/PRODUCTION_READINESS_AUDIT_2026-08-30.md` đã sửa:

- **P0-1** — migration `202608300004` khôi phục `order_get_by_access` thành
  SECURITY DEFINER (bản `202608270002` từng ép thành invoker → trang
  confirmation/chi tiết đơn 404 với guest), drop overload 5-arg hỏng của
  `place_order_internal`, `calculate_shipping` thành definer + grant
  `shipping_rates` cho anon. pgTAP mới `order_access_security.sql` chạy RPC
  dưới `set local role anon`; e2e giờ assert nội dung trang thay vì chỉ URL.
- **P0-2** — backup tách thành workflow riêng `.github/workflows/backup.yml`
  cron `0 3 * * 1` + `workflow_dispatch` (job cũ trong monitor.yml gate trên
  schedule không bao giờ khớp → không bao giờ chạy).

Còn lại thuộc mục A dưới đây: add secrets + deploy vẫn là việc phía owner.

## A. Secrets chưa add (chặn monitor/alert/backup — làm ngay sau deploy)

Workflow `monitor.yml`, `rls-prod.yml`, `alert-on-failure.yml`, backup
storage đều đỏ cho tới khi add đủ secrets vào **GitHub repo** (Settings →
Secrets and variables → Actions) và **Vercel env**:

| Secret | Dùng cho | Lấy ở đâu |
|---|---|---|
| `PROD_BASE_URL` | Monitor health/cron probes | URL Vercel sau deploy lần 1 |
| `SUPABASE_DB_URL` | Drift check, backup, row-count compare | Supabase → Settings → Database → Connection string (URI) |
| `CRON_SECRET` | Monitor gọi `/api/cron/health`; cũng set cùng giá trị trong Vercel env | `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Backup upload Storage (GitHub side) | Supabase → Settings → API |
| `TELEGRAM_BOT_TOKEN` | Alert workflow đỏ | @BotFather |
| `TELEGRAM_CHAT_ID` | Alert workflow đỏ | Nhắn bot rồi GET /getUpdates |

Không add → các workflow tương ứng skip gracefully hoặc đỏ hoài, không
ảnh hưởng storefront chạy.

**Cách làm nhanh (2026-09-12):** chạy wizard `./scripts/ops-bootstrap.sh` —
dẫn từng bước lấy 6 secrets, tự gán vào GitHub qua `gh secret set`, gán
Vercel env `CRON_SECRET`, sinh `CRON_SECRET` ngẫu nhiên, test gửi Telegram,
rồi **trigger workflow Backup thật 1 lần và chứng minh pass** (dump →
upload Storage → restore proof → row-count match). Secrets tạm lưu ở
`.env.ops-wizard` (đã git-ignore) để chạy lại không phải paste lại.

**Chạy lần 1 bị đỏ — đã chẩn đoán và fix (2026-09-12):** xem
`docs/ops/TODO-GOLIVE.md`. Ngắn gọn: DB URL phải là **Session pooler**
(host direct là IPv6-only, GitHub không nối nổi), `PROD_BASE_URL` phải là
URL app đã deploy (không phải URL dashboard), và DB cloud còn thiếu hầu hết
migrations (`supabase db push` trước). Wizard v2 đã validate cả ba lỗi này
tại chỗ; các secrets sai đã xóa khỏi GitHub.

## A2. Preview không còn ghi được vào DB prod (OPS-003) — ĐÃ GUARD (2026-09-12)

`proxy.ts` giờ chặn mọi request ghi khi `VERCEL_ENV=preview` trừ khi đặt
`ALLOW_PREVIEW_WRITES=1` ở env preview — PR preview chỉ xem được UI, không
checkout/duyệt trả hàng/chỉnh tồn kho vào data thật. Test
`tests/security/preview-guard.test.ts`. Lộ trình staging project riêng:
`docs/ops/STAGING.md` (làm khi có người cộng tác).

## B. Giới hạn nghiệp vụ đã ghi trong code (đọc trước khi bán)

### B1. Abandoned-cart email — ĐÃ MỞ KHÓA (2026-08-30)

`cart_capture_email` (migration `202608300003`) giờ ghi email từ form
checkout vào `carts.email` ngay khi khách submit, trước khi place_order
convert giỏ. RPC `queue_abandoned_cart_emails` mỗi 2 giờ có địa chỉ để
gửi. Còn thiếu duy nhất: email là **tùy chọn** ở form — khách bỏ trống
thì vẫn không nhắc được (đúng thiết kế, không ép email).

### B2. Refund VNPay là ghi nhận thủ công, không hoàn tiền tự động

`admin_decide_return` chỉ ghi `refund_amount` vào `order_returns` +
audit log. Shop phải vào dashboard VNPay hoàn tiền tay. Không gọi
VNPay refund API (cần tmn_code + secret refund riêng + ký HMAC).

**Miệng hếch đã bịt (2026-09-12):** form duyệt trả hàng giờ hiển thị cảnh
báo "phải chuyển tiền qua dashboard merchant.vnpayment.vn rồi mới duyệt"
khi đơn thanh toán qua VNPay (`components/admin/returns-table.tsx`) —
nhân viên không còn tưởng bấm duyệt là đã hoàn tiền. Test:
`tests/ui/returns-table.test.tsx`.

**Khi nào cần tự động:** > 20 refund/tháng hoặc thuê nhân viên riêng xử
lý CSKH. Tự động: 1-2 ngày, `lib/commerce/vnpay.ts` thêm
`refundTransaction()`, RPC gọi với verified actor.

### B3. CSV import 1 dòng = 1 variant mặc định

Sản phẩm nhiều biến thể (màu × dung tích) phải thêm tay sau import.
Đủ dùng cho catalog đơn giản; catalog phức tạp cần import 2 file
(products + variants riêng, join qua slug) hoặc cột variant lặp.

**Khi nào cần:** nhập > 500 sp đa biến thể cùng lúc.

### B4. Coupon redemption được hoàn khi return được duyệt — ĐÃ LÀM (2026-08-30)

`admin_decide_return` khi approve giờ release `coupon_redemptions`
(cột `released_at`), trả quota cho coupon 1-lần-dùng. Đơn bị từ chối
giữ nguyên redemption (khách giữ đơn, đã hưởng giảm giá).

### B5. `returned` order không hoàn VNPay amount tự động + không xuất hóa đơn

Không có hóa đơn điện tử (MISA/Viettel) — shop bán thật cần hóa đơn
theo quy định thuế VN nếu đăng ký kinh doanh có phát hành hóa đơn.
**Khi nào cần:** khi doanh thu cần kê khai thuế GTGT.

## C. Việc kỹ thuật đã bỏ qua có chủ đích (YAGNI — làm khi có trigger)

| Việc | Trigger làm lại |
|---|---|
| Materialized view cho `catalog_products` (4 subquery per row) | Catalog > 5.000 sp HOẶC `/products` DB latency > 500ms thường xuyên |
| ISR cho `/products` (searchParams đang chặn static) | CacheComponents refactor khi Next 16 ổn định `use cache` |
| PPR (cacheComponents) | Sau khi Next 16 hết breaking với `revalidate` route config |
| Rate limit per-IP trên API routes (hiện chỉ per-email cho auth) | Thấy brute force theo IP trong logs |
| `/admin` đổi path ngẫu nhiên cho khỏi bot scan | Log spam quá ồn |
| Wishlist/compare sync server-side | Khách phàn nàn mất list khi đổi máy |
| Customer order self-cancel trước khi fulfillment | Khách hỏi nhiều |
| Multi-variant CSV (B3), carrier API (GHN/GHTK), e-invoice (B5) | Theo business needs |

## D. Nợ kỹ thuật nhỏ

1. `app/(storefront)/products/[slug]/page.tsx` vẫn dynamic (nonce CSP
   trong JSON-LD + `getAuthUser`). Đã ghi trong commit `88232f2` — ISR
   cho trang này cần bỏ nonce khỏi JsonLd hoặc chuyển JSON-LD qua route
   riêng, kèm cân nhắc an ninh. Chưa làm vì product detail ít traffic
   nhất trong 3 trang chính và việc đúng CSP quan trọng hơn cache.
2. Lighthouse workflow (`.github/workflows/lighthouse.yml`) chưa từng
   chạy lần nào (mới tạo, schedule thứ Hai). Chạy `workflow_dispatch`
   tay 1 lần sau deploy để xác nhận floor 80 phù hợp thực tế; chỉnh
   floor nếu build production thật chậm hơn local.
3. `supabase test db` hiện 21 files — có RLS smoke cho `order_returns`
   (bảng bật RLS, không policy, access chỉ qua RPC) trong
   `cart_capture_email.sql`. Còn thiếu RLS test chi tiết cho các bảng
   khác thêm sau này (pattern đã có sẵn để copy).
4. E2E Playwright (`e2e/`) có smoke + admin CRUD; chưa có spec cho:
   return flow, CSV import, bulk price. Thêm khi sửa những flow này
   lần tới (regression risk cao nhất nằm đúng ở đây).

## E. Việc account-side chỉ chủ shop làm được (không code)

1. Deploy Vercel + link Supabase cloud (xem `docs/ops/DEPLOY.md`).
2. Add secrets bảng ở mục A.
3. Mua domain + Cloudflare CDN (`docs/ops/CLOUDFLARE_SETUP.md`).
4. Resend verify domain + đổi `EMAIL_FROM`.
5. VNPay merchant thật (thay sandbox) + đổi return/IPN URL sau khi có
   domain.
6. 2FA cho GitHub/Vercel/Supabase/Resend/Sentry/VNPay.
7. Branch protection main + Dependabot/secret scanning bật.
8. Tạo Sentry project + DSN nếu muốn error tracking.
