# API — TechStore

Storefront đọc qua RLS + RPC `SECURITY DEFINER` (zero-policy). Không gọi bảng trực tiếp.

- Cart: `POST /api/cart` (`cart_get/add/update/remove/apply_coupon`), validation `lib/commerce/validation.ts`.
- Checkout: server action `checkoutAction` → RPC `place_order` (wrapper trust-boundary, rate-limit 5/15m, idempotency_key).
- Track: `order_track` (code+phone, generic `ORDER_NOT_FOUND`), `order_get_by_access` (code+token).
- VNPay: `GET /api/vnpay/ipn` luôn 200, `GET /api/vnpay/return`; verify HMAC `lib/commerce/vnpay.ts`.
- Suggest: `GET /api/catalog/suggest?q=` (429 khi quá tải).
- Cron (cần `Authorization: Bearer CRON_SECRET`): `process-notifications`, `release-expired-reservations`, `abandoned-carts`, `purge-logs`, `health`.
- Health: `GET /api/health`, `?check=db` query `products` qua anon.
- Admin: server actions trong `lib/admin/*` + gate `require-admin.ts` + MFA AAL2.
