# Backends — map hệ thống của bạn (port từ blueprint)

Mỗi backend method gọi service của bạn server-side bằng credential host giữ cho
session; model chỉ đọc DTO trả về. Flow có thứ tự bước cố định thì enforce thứ
tự trong backend (không trông chờ model đi đúng thứ tự).

## Shopping (`lib/assistant/backend.ts`, `cart.ts`)

| Method | TechStore hiện tại | Thay bằng gì |
|---|---|---|
| search / product details | `lib/catalog/queries` (Supabase) | catalog API của bạn |
| cart (get/add/update/remove) | giỏ guest qua RPC + cookie hash | cart service + session credential |
| checkout handoff | link `/checkout` nội bộ | hosted checkout URL (mỗi seller một URL nếu marketplace) |
| track_order / order history | `orders` + `order_items` (phone-verified) | order system; giá quoted là của session account nếu có giá theo hợp đồng |
| fulfillment options | `shipping_rates` + `stores` | rate service; pickup = allocation của store |
| policies | passages tĩnh `lib/assistant/policies.ts` | CMS trang pháp lý (giữ đồng bộ 2 chiều) |
| memory | `customer_memories` (SHA-256 session) | store của bạn; giữ validation không PII |

## Merchant (`lib/assistant/merchant/backend.ts`)

| Method | TechStore hiện tại | Thay bằng gì |
|---|---|---|
| snapshot / analysis templates | SQL allowlist 5 template | warehouse của bạn (Snowflake/BigQuery/Databricks/Amplitude) qua backend method |
| listings / pricing / stock reads | catalog admin queries | catalog/inventory/pricing systems |
| stage publish/price/stock | envelope HMAC + ledger `assistant_staged_changes` | change system của bạn; giữ verify-chữ-ký → đọc LIVE → re-check → apply + audit |
| campaign briefs | `draft_campaign_brief` (advisory) | finance/delivery connectors (Stripe/Square/PayPal, Slack/Drive/Gmail) khi cần apply thật |

## Bắt đầu nhỏ

Shopping pilot: implement search + details, stub còn lại trả `unavailable` (không đổi byte prompt). Merchant pilot: 8 read methods, writes `refuse` — digest + metrics chạy không write path.
