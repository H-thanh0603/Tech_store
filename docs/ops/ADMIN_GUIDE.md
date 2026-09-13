# Admin Guide — TechStore

- Login: `/admin/login` bằng Supabase Auth + dòng active trong `admin_users`. Mọi Admin/Manager/Staff bắt buộc TOTP AAL2 (`/admin/mfa/*`).
- Dashboard `/admin`: KPI + đơn gần đây + cảnh báo tồn kho.
- Products `/admin/products`: tạo/sửa/archive, bulk giá/tồn (`202609010001`), CSV import `/admin/products/import`, 5 ảnh/sản phẩm. Không xóa cứng SP đã bán (trigger `chk_block_product_delete`).
- Orders `/admin/orders/[code]`: `pending→awaiting_payment→confirmed→packing→shipping→completed`, `markOrderPaid`, note nội bộ, returns `decideReturn`. Refund VNPay hiện **thủ công** — xem `lib/commerce/vnpay-refund.ts`.
- Coupons `/admin/coupons`, Customers, Content, Audit export `/api/admin/audit/export`.
- Seed local: `npm run admin:seed` (mặc định `admin@techstore.local`).
