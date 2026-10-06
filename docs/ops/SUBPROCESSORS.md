# Subprocessors & Data Residency — TechStore (Q67)

Cập nhật khi thêm vendor mới. DPA: dùng Data Processing Addendum chuẩn của từng vendor (liên kết trong dashboard của họ); thị trường chính là Việt Nam (NĐ 13/2023).

| Vendor | Dữ liệu gửi | Residency | Mục đích |
|---|---|---|---|
| Supabase (Postgres + Auth + Storage) | Toàn bộ dữ liệu app (đơn, hồ sơ, chat memory) | Region project (xem dashboard; chọn Singapore cho VN) | Database, auth, file |
| Vercel | Request/trace deploy, log runtime | `regions: ["sin1"]` (`vercel.json`) | Hosting, CDN, cron |
| Resend | Email người nhận + nội dung mail giao dịch | US (vendor default) | Email đơn hàng |
| Anthropic / DeepSeek / OpenRouter / TokenRouter (tùy `ASSISTANT_PROVIDER`) | Tin nhắn chat + (theo privacy §5) mã đơn/SĐT khi tra đơn | Theo vendor đã chọn | LLM trợ lý |
| TypeSafe JEV / Vercel AI Gateway (tùy `JEV_*`) | Tin nhắn chat (phân loại), không PII định danh | Theo vendor đã chọn | Phân loại ý định |
| VNPay | Mã đơn, số tiền, IP | VN | Cổng thanh toán |
| Sentry | Lỗi + trace (đã mask text/media: `maskAllText`, `blockAllMedia`) | US/EU theo cấu hình org | Error tracking |
| GitHub Actions | Dump DB mã hóa (artifact 30d) | Theo runner region | CI + backup |

Không gửi cho vendor: CCCD (không thu thập), thẻ ngân hàng (qua VNPay, không qua server), OTP (không nhập vào chat theo privacy §5).
