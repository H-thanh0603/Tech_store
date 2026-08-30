# BACKLOG — những thứ còn thiếu, ghi rõ trước khi vận hành thật

Tất cả những gì đã được ghi nhận là "giới hạn" hoặc "chưa làm" trong code
session 2026-08-29 → 08-30. Mỗi mục: tại sao chưa làm, làm khi nào, và
chìa khóa mở (nếu có).

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

## B. Giới hạn nghiệp vụ đã ghi trong code (đọc trước khi bán)

### B1. Abandoned-cart email chưa gửi được — thiếu email capture

`carts.email` (migration `202608300002`) tồn tại nhưng **không code path
nào ghi email vào đó**. Guest cart hoàn toàn anonymous (chỉ có
token_hash). RPC `queue_abandoned_cart_emails` chạy mỗi 2h nhưng không
queue được gì cho tới khi storefront capture email.

**Cách mở:** thêm trường email tùy chọn ở bước đầu checkout (hoặc
newsletter popup), ghi vào `carts.email` qua 1 RPC nhỏ. ~nửa ngày.
File: `lib/commerce/actions.ts` (checkout flow), migration mới.

### B2. Refund VNPay là ghi nhận thủ công, không hoàn tiền tự động

`admin_decide_return` chỉ ghi `refund_amount` vào `order_returns` +
audit log. Shop phải vào dashboard VNPay hoàn tiền tay. Không gọi
VNPay refund API (cần tmn_code + secret refund riêng + ký HMAC).

**Khi nào cần tự động:** > 20 refund/tháng hoặc thuê nhân viên riêng xử
lý CSKH. Tự động: 1-2 ngày, `lib/commerce/vnpay.ts` thêm
`refundTransaction()`, RPC gọi với verified actor.

### B3. CSV import 1 dòng = 1 variant mặc định

Sản phẩm nhiều biến thể (màu × dung tích) phải thêm tay sau import.
Đủ dùng cho catalog đơn giản; catalog phức tạp cần import 2 file
(products + variants riêng, join qua slug) hoặc cột variant lặp.

**Khi nào cần:** nhập > 500 sp đa biến thể cùng lúc.

### B4. Refund không trả coupon về cho khách

`admin_decide_return` hoàn tồn kho + ghi refund amount, nhưng
`coupon_redemptions` của đơn đã dùng không được hoàn lại quota (coupon
1 lần dùng / khách vẫn coi như đã tiêu). Đơn giản và an toàn (tránh
lạm dụng); nếu muốn hoàn coupon, thêm 1 update trong RPC với điều kiện
chỉ hoàn khi reject (đơn về trạng thái completed thì giữ nguyên).

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
3. `supabase test db` hiện 20 files/213 tests — chạy trong CI mỗi push.
   Thêm test RLS cho policy mới (order_returns) khi đụng bảng đó lần
   nữa; hiện tại chỉ trust boundary qua RPC tests.
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
