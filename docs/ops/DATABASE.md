# Database — TechStore

- Postgres Supabase, 77 migrations tuyến tính `supabase/migrations/YYYYMMDD*.sql`, seed `supabase/seed.sql`.
- Catalog: `categories/brands/products/variants/inventory/images/specs`, view `catalog_products` (published && !archived).
- Commerce: `carts/cart_items(price_at_add)/orders(idempotency_key)/order_items(unit_price,line_total)/reservations/coupon_redemptions/notification_outbox`.
- Nguyên tắc: giá đơn lấy snapshot `unit_price`, không dùng giá hiện tại; tồn = `quantity - reserved - active reservations` (`available_variant_stock()`); lock `ORDER BY variant_id FOR UPDATE` chống oversell.
- RLS ON + revoke anon/authenticated, chỉ RPC `SECURITY DEFINER, search_path=public,pg_temp`.
- Soft-delete: `is_published/is_archived/is_active`, chặn xóa cứng đã bán. Audit `admin_audit_logs` giữ tối thiểu 30d.
- Indexes hot: `orders(code/idempotency/user,created)`, `order_items(variant_id)` (20260914), `reservations(variant,expires) partial`.
- Backup: `backup.yml` dump weekly → Storage `backups/` + artifact 90d + restore-proof. Không PITR ở free-tier.
