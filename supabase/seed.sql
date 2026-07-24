-- Deterministic catalog seed. Fixed UUIDs + slugs/SKUs make `supabase db reset`
-- idempotent. Products are inserted unpublished, then published in a final
-- UPDATE step once their variants exist, because the publish trigger requires
-- at least one active variant to already be present.

-- Categories

insert into categories (id, parent_id, name, slug, is_active) values
  ('10000000-0000-0000-0000-000000000001', null, 'Laptop', 'laptop', true),
  ('10000000-0000-0000-0000-000000000002', null, 'Điện thoại', 'dien-thoai', true),
  ('10000000-0000-0000-0000-000000000003', null, 'Phụ kiện', 'phu-kien', true),
  ('10000000-0000-0000-0000-000000000004', null, 'Ngừng kinh doanh', 'ngung-kinh-doanh', false)
on conflict (id) do nothing;

-- Brands

insert into brands (id, name, slug, logo_url, is_active) values
  ('20000000-0000-0000-0000-000000000001', 'Apple', 'apple', null, true),
  ('20000000-0000-0000-0000-000000000002', 'Dell', 'dell', null, true),
  ('20000000-0000-0000-0000-000000000003', 'Samsung', 'samsung', null, true),
  ('20000000-0000-0000-0000-000000000004', 'Brand Ngừng Hợp Tác', 'brand-ngung-hop-tac', null, false)
on conflict (id) do nothing;

-- Products (all start unpublished; published below once variants exist)

insert into products (id, category_id, brand_id, name, slug, description, is_published, is_featured, is_archived) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'MacBook Air M3',
    'macbook-air-m3',
    'Laptop mỏng nhẹ với chip Apple M3, phù hợp học tập và làm việc văn phòng.',
    false,
    true,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'Dell XPS 13',
    'dell-xps-13',
    'Laptop lập trình viên với màn hình sắc nét và hiệu năng ổn định.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'Samsung Galaxy S24 Ultra 512GB Titan Đen Phiên Bản Giới Hạn Cao Cấp Dành Cho Người Dùng Chuyên Nghiệp',
    'samsung-galaxy-s24-ultra-512gb-titan-den-phien-ban-gioi-han-cao-cap',
    'Flagship Samsung với camera 200MP và bút S Pen tích hợp.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    null,
    'Tai Nghe Chưa Ra Mắt',
    'tai-nghe-chua-ra-mat',
    'Sản phẩm đang chờ ra mắt, chưa xuất bản trên catalog.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    'Samsung Galaxy Buds3 Pro',
    'samsung-galaxy-buds3-pro',
    'Tai nghe true wireless chống ồn chủ động, nhiều màu lựa chọn.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'Dell XPS 15 (Ngừng Bán)',
    'dell-xps-15-ngung-ban',
    'Model cũ đã ngừng kinh doanh, chỉ giữ lại cho mục đích lưu trữ.',
    false,
    false,
    true
  )
on conflict (id) do nothing;

-- Variants

insert into product_variants (id, product_id, sku, attributes, regular_price, sale_price, is_active) values
  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'MBA-M3-256-SLV',
    '{"ram": "8GB", "storage": "256GB", "color": "Bạc"}'::jsonb,
    27990000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'MBA-M3-512-SLV',
    '{"ram": "8GB", "storage": "512GB", "color": "Bạc"}'::jsonb,
    32990000,
    30990000,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    'XPS13-I7-512',
    '{"ram": "16GB", "storage": "512GB", "color": "Bạc"}'::jsonb,
    35990000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000003',
    'S24U-512-TIT',
    '{"storage": "512GB", "color": "Titan Đen"}'::jsonb,
    33990000,
    31990000,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000004',
    'TN-PRE-001',
    '{}'::jsonb,
    1990000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000005',
    'BUDS3PRO-BLK',
    '{"color": "Đen"}'::jsonb,
    4490000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000007',
    '30000000-0000-0000-0000-000000000005',
    'BUDS3PRO-WHT',
    '{"color": "Trắng"}'::jsonb,
    4490000,
    3990000,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000008',
    '30000000-0000-0000-0000-000000000005',
    'BUDS3PRO-SLV',
    '{"color": "Bạc"}'::jsonb,
    4490000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000009',
    '30000000-0000-0000-0000-000000000006',
    'XPS15-ARCHIVED',
    '{"ram": "16GB", "storage": "512GB"}'::jsonb,
    40000000,
    null,
    true
  )
on conflict (id) do nothing;

-- Inventory (V_MBA_512 and V_BUDS_SILVER are out of stock)

insert into inventory (id, variant_id, quantity, reserved_quantity, low_stock_threshold) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 20, 2, 5),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, 0, 5),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 5, 0, 5),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', 10, 1, 5),
  ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 100, 0, 5),
  ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', 15, 0, 5),
  ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000007', 8, 1, 5),
  ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000008', 0, 0, 5),
  ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000009', 3, 0, 5)
on conflict (id) do nothing;

-- Images (Dell XPS 13 intentionally has none: missing-image edge case)

insert into product_images (id, product_id, variant_id, url, alt_text, sort_order) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, 'https://placehold.co/800x800?text=MacBook+Air+1', 'MacBook Air M3 mặt trước', 0),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', null, 'https://placehold.co/800x800?text=MacBook+Air+2', 'MacBook Air M3 góc nghiêng', 1),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', null, 'https://placehold.co/800x800?text=Galaxy+S24+Ultra', 'Samsung Galaxy S24 Ultra', 0),
  ('60000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', null, 'https://placehold.co/800x800?text=Tai+Nghe', 'Tai nghe chưa ra mắt', 0),
  ('60000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', null, 'https://placehold.co/800x800?text=Galaxy+Buds3+Pro', 'Samsung Galaxy Buds3 Pro', 0),
  ('60000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', null, 'https://placehold.co/800x800?text=Dell+XPS+15', 'Dell XPS 15 ngừng bán', 0)
on conflict (id) do nothing;

-- Specs

insert into product_specs (id, product_id, group_name, label, value, sort_order) values
  ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Hiệu năng', 'Chip', 'Apple M3', 0),
  ('70000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Hiệu năng', 'RAM', '8GB', 1),
  ('70000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Màn hình', 'Kích thước', '13.6 inch', 2),
  ('70000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'Hiệu năng', 'CPU', 'Intel Core i7', 0),
  ('70000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'Màn hình', 'Kích thước', '13.4 inch', 1),
  ('70000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'Màn hình', 'Kích thước', '6.8 inch', 0),
  ('70000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000003', 'Camera', 'Độ phân giải', '200MP', 1),
  ('70000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000004', 'Âm thanh', 'Chống ồn', 'Chủ động', 0),
  ('70000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000005', 'Âm thanh', 'Chống ồn', 'Chủ động', 0),
  ('70000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000005', 'Pin', 'Thời lượng', '6 giờ', 1),
  ('70000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000006', 'Hiệu năng', 'CPU', 'Intel Core i7', 0)
on conflict (id) do nothing;

-- Use cases

insert into product_use_cases (id, product_id, use_case) values
  ('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'hoc-tap'),
  ('80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'van-phong'),
  ('80000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'lap-trinh'),
  ('80000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'giai-tri'),
  ('80000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000004', 'giai-tri'),
  ('80000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000005', 'giai-tri'),
  ('80000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000005', 'van-phong'),
  ('80000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000006', 'van-phong')
on conflict (id) do nothing;

-- Publish products that should be visible (each already has an active variant).
-- Product 4 (Tai Nghe Chưa Ra Mắt) stays unpublished on purpose.
-- Product 6 (Dell XPS 15) is published and archived: still hidden via is_archived.

update products set is_published = true
where id in (
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000005',
  '30000000-0000-0000-0000-000000000006'
);

-- Demo commerce coupons. Whole-VND values; fixed dates keep reset deterministic.
insert into coupons (
  id, code, discount_type, discount_value, minimum_order,
  maximum_discount, starts_at, ends_at, usage_limit, is_active
) values
  ('90000000-0000-0000-0000-000000000010', 'WELCOME10', 'percentage', 10, 1000000, 5000000, '2026-01-01T00:00:00Z', '2030-01-01T00:00:00Z', null, true),
  ('90000000-0000-0000-0000-000000000011', 'SAVE500K', 'fixed', 500000, 10000000, null, '2026-01-01T00:00:00Z', '2030-01-01T00:00:00Z', null, true),
  ('90000000-0000-0000-0000-000000000012', 'EXPIRED10', 'percentage', 10, 0, null, '2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z', null, false)
on conflict (id) do update set
  code = excluded.code,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  minimum_order = excluded.minimum_order,
  maximum_discount = excluded.maximum_discount,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  usage_limit = excluded.usage_limit,
  is_active = excluded.is_active;
