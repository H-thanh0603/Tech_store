# Troubleshooting — TechStore

- `ORDER_NOT_FOUND` khi track: sai code/phone hoặc hết rate-limit (2/15m) — lỗi generic cố ý.
- `PRICE_CHANGED/OUT_OF_STOCK`: giá/tồn đổi giữa chừng, cho khách load lại cart.
- `ALREADY_PAID/PAYMENT_CONFLICT/AMOUNT_MISMATCH`: VNPay gọi lại — check `payment_ref` unique, không thu 2 lần.
- `CONFIGURATION_ERROR` checkout VNPay: thiếu `VNPAY_TMN_CODE/HASH_SECRET`.
- Email không đi: thiếu `RESEND_API_KEY` → row `pending` trong `notification_outbox`, checkout không block.
- Cron 401: sai/thiếu `CRON_SECRET`.
- Preview ghi bị chặn: `proxy.ts` block POST ở preview trừ `ALLOW_PREVIEW_WRITES=1`.
- Health: `/api/health?check=db` 503 = sai env hoặc RLS anon bị chặn.
- Sentry: lỗi cron đã `reportCronError`, lỗi UI vào boundary `app/error.tsx` + `global-error.tsx` (cần `SENTRY_DSN`).
