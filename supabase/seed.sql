-- Deterministic catalog seed. Fixed UUIDs + slugs/SKUs make `supabase db reset`
-- idempotent. Products are inserted unpublished, then published in a final
-- UPDATE step once their variants exist, because the publish trigger requires
-- at least one active variant to already be present.

-- Categories

insert into categories (id, parent_id, name, slug, is_active) values
  ('10000000-0000-0000-0000-000000000001', null, 'Laptop', 'laptop', true),
  ('10000000-0000-0000-0000-000000000002', null, 'Điện thoại', 'dien-thoai', true),
  ('10000000-0000-0000-0000-000000000003', null, 'Phụ kiện', 'phu-kien', true),
  ('10000000-0000-0000-0000-000000000004', null, 'Ngừng kinh doanh', 'ngung-kinh-doanh', false),
  -- S3 (§4.6–§4.11): danh mục bổ sung cho các cụm PC/màn hình, âm thanh/wearable,
  -- hàng cũ. "Hàng cũ" là danh mục riêng (không phải trạng thái sản phẩm) vì spec
  -- §4.11 yêu cầu cam kết tình trạng + bảo hành riêng, khác nội dung hàng mới.
  ('10000000-0000-0000-0000-000000000005', null, 'PC', 'pc', true),
  ('10000000-0000-0000-0000-000000000006', null, 'Màn hình', 'man-hinh', true),
  ('10000000-0000-0000-0000-000000000007', null, 'Âm thanh', 'am-thanh', true),
  ('10000000-0000-0000-0000-000000000008', null, 'Đồng hồ thông minh', 'dong-ho', true),
  ('10000000-0000-0000-0000-000000000009', null, 'Hàng cũ', 'hang-cu', true)
on conflict (id) do nothing;

-- Brands

insert into brands (id, name, slug, logo_url, is_active) values
  ('20000000-0000-0000-0000-000000000001', 'Apple', 'apple', null, true),
  ('20000000-0000-0000-0000-000000000002', 'Dell', 'dell', null, true),
  ('20000000-0000-0000-0000-000000000003', 'Samsung', 'samsung', null, true),
  ('20000000-0000-0000-0000-000000000004', 'Brand Ngừng Hợp Tác', 'brand-ngung-hop-tac', null, false),
  -- S3: thêm brand để tabs thương hiệu (§4.6 điện thoại, §4.7 laptop) có nhiều
  -- hơn 2 lựa chọn thật.
  ('20000000-0000-0000-0000-000000000005', 'Asus', 'asus', null, true),
  ('20000000-0000-0000-0000-000000000006', 'Sony', 'sony', null, true),
  ('20000000-0000-0000-0000-000000000007', 'JBL', 'jbl', null, true),
  ('20000000-0000-0000-0000-000000000008', 'Xiaomi', 'xiaomi', null, true)
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
  ),
  -- S3 (§4.6–§4.11): thêm sản phẩm cho các cụm còn thiếu ngành hàng.
  -- Điện thoại thêm brand để tabs thương hiệu §4.6 có ý nghĩa.
  (
    '30000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000008',
    'Xiaomi Redmi Note 13',
    'xiaomi-redmi-note-13',
    'Điện thoại tầm trung pin lớn, phù hợp dùng hàng ngày.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'iPhone 15',
    'iphone-15',
    'Flagship Apple với chip A16 và camera cải tiến.',
    false,
    true,
    false
  ),
  -- Laptop thêm brand Asus để tab "Gaming" (§4.7) có sản phẩm thật.
  (
    '30000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000005',
    'Asus ROG Strix G16',
    'asus-rog-strix-g16',
    'Laptop gaming hiệu năng cao, tản nhiệt tốt cho tác vụ nặng.',
    false,
    false,
    false
  ),
  -- PC (§4.8)
  (
    '30000000-0000-0000-0000-00000000000a',
    '10000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000005',
    'Asus PC Văn Phòng ProArt',
    'asus-pc-van-phong-proart',
    'PC để bàn cho công việc văn phòng và đa nhiệm nhẹ.',
    false,
    false,
    false
  ),
  -- Màn hình (§4.8)
  (
    '30000000-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000005',
    'Asus TUF Gaming VG27',
    'asus-tuf-gaming-vg27',
    'Màn hình gaming 27 inch tần số quét cao, phù hợp game tốc độ nhanh.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-00000000000c',
    '10000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000003',
    'Samsung ViewFinity S8',
    'samsung-viewfinity-s8',
    'Màn hình 4K cho dựng phim và thiết kế, màu chuẩn.',
    false,
    false,
    false
  ),
  -- Âm thanh (§4.9)
  (
    '30000000-0000-0000-0000-00000000000d',
    '10000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000007',
    'JBL Flip 6',
    'jbl-flip-6',
    'Loa bluetooth di động chống nước, âm bass mạnh.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-00000000000e',
    '10000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000006',
    'Sony WH-1000XM5',
    'sony-wh-1000xm5',
    'Tai nghe chống ồn cao cấp, pin 30 giờ.',
    false,
    true,
    false
  ),
  -- Wearable / đồng hồ (§4.9)
  (
    '30000000-0000-0000-0000-00000000000f',
    '10000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000001',
    'Apple Watch SE',
    'apple-watch-se',
    'Đồng hồ thông minh theo dõi sức khỏe, tương thích iPhone.',
    false,
    false,
    false
  ),
  -- Hàng cũ (§4.11): sản phẩm đã qua sử dụng, kiểm định lại, danh mục riêng.
  (
    '30000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000009',
    '20000000-0000-0000-0000-000000000001',
    'iPhone 12 Cũ - 99%',
    'iphone-12-cu-99',
    'Máy đã qua kiểm định 15 điểm, ngoại hình 99%, bảo hành riêng 6 tháng.',
    false,
    false,
    false
  ),
  (
    '30000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000009',
    '20000000-0000-0000-0000-000000000002',
    'Dell Latitude Cũ - Like New',
    'dell-latitude-cu-like-new',
    'Laptop văn phòng cũ đã kiểm định, phù hợp học tập với chi phí thấp.',
    false,
    false,
    false
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
  ),
  -- S3: variants cho sản phẩm mới (7–11)
  (
    '40000000-0000-0000-0000-00000000000a',
    '30000000-0000-0000-0000-000000000007',
    'REDMI-N13-128',
    '{"storage": "128GB", "color": "Đen"}'::jsonb,
    4990000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-00000000000b',
    '30000000-0000-0000-0000-000000000008',
    'IP15-128-BLK',
    '{"storage": "128GB", "color": "Đen"}'::jsonb,
    22990000,
    21490000,
    true
  ),
  (
    '40000000-0000-0000-0000-00000000000c',
    '30000000-0000-0000-0000-000000000009',
    'ROG-G16-I7-16-512',
    '{"ram": "16GB", "storage": "512GB", "color": "Đen"}'::jsonb,
    38990000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-00000000000d',
    '30000000-0000-0000-0000-00000000000a',
    'PROART-PC-16-512',
    '{"ram": "16GB", "storage": "512GB"}'::jsonb,
    18990000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-00000000000e',
    '30000000-0000-0000-0000-00000000000b',
    'TUF-VG27-165HZ',
    '{"size": "27 inch", "refreshRate": "165Hz"}'::jsonb,
    6990000,
    6490000,
    true
  ),
  (
    '40000000-0000-0000-0000-00000000000f',
    '30000000-0000-0000-0000-00000000000c',
    'VIEWFINITY-S8-4K',
    '{"size": "27 inch", "resolution": "4K"}'::jsonb,
    13990000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000010',
    '30000000-0000-0000-0000-00000000000d',
    'JBL-FLIP6-BLK',
    '{"color": "Đen"}'::jsonb,
    2490000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000011',
    '30000000-0000-0000-0000-00000000000e',
    'SONY-XM5-BLK',
    '{"color": "Đen"}'::jsonb,
    8490000,
    7490000,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000012',
    '30000000-0000-0000-0000-00000000000f',
    'AWSE-44-GPS',
    '{"size": "44mm", "color": "Bạc"}'::jsonb,
    6790000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000013',
    '30000000-0000-0000-0000-000000000010',
    'IP12-CU-99-128',
    '{"storage": "128GB", "color": "Xanh", "condition": "99%"}'::jsonb,
    9490000,
    null,
    true
  ),
  (
    '40000000-0000-0000-0000-000000000014',
    '30000000-0000-0000-0000-000000000011',
    'LATITUDE-CU-LN',
    '{"ram": "8GB", "storage": "256GB", "condition": "Like New"}'::jsonb,
    8990000,
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
  ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000009', 3, 0, 5),
  -- S3: inventory cho variants 10–14
  ('50000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a', 30, 2, 5),
  ('50000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-00000000000b', 12, 1, 5),
  ('50000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-00000000000c', 6, 0, 5),
  ('50000000-0000-0000-0000-00000000000d', '40000000-0000-0000-0000-00000000000d', 9, 0, 5),
  ('50000000-0000-0000-0000-00000000000e', '40000000-0000-0000-0000-00000000000e', 14, 2, 5),
  ('50000000-0000-0000-0000-00000000000f', '40000000-0000-0000-0000-00000000000f', 7, 0, 5),
  ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', 25, 3, 5),
  ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011', 11, 1, 5),
  ('50000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000012', 16, 0, 5),
  ('50000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000013', 4, 0, 5),
  ('50000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000000014', 3, 0, 5)
on conflict (id) do nothing;

-- Store allocations depend on the inventory rows seeded above. Migrations run
-- before this file on a clean reset, so seed these allocations here as well.
insert into store_inventory (store_id, variant_id, quantity)
select store_id, variant_id, allocated
from (
  select '92000000-0000-4000-8000-000000000001'::uuid as store_id,
    variant_id, least(quantity, 3) as allocated from inventory
  union all
  select '92000000-0000-4000-8000-000000000002'::uuid,
    variant_id, least(greatest(quantity - 3, 0), 2) from inventory
  union all
  select '92000000-0000-4000-8000-000000000003'::uuid,
    variant_id, least(greatest(quantity - 5, 0), 1) from inventory
) seed
where allocated > 0
on conflict (store_id, variant_id) do nothing;

-- Images (Dell XPS 13 intentionally has none: missing-image edge case)

insert into product_images (id, product_id, variant_id, url, alt_text, sort_order) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, '/product-images/real/macbook-air-m3-1.jpg', 'MacBook Air M3 mặt trước', 0),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', null, '/product-images/real/macbook-air-m3-2.jpg', 'MacBook Air M3 góc nghiêng', 1),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', null, '/product-images/real/galaxy-s24-ultra.jpg', 'Samsung Galaxy S24 Ultra', 0),
  ('60000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', null, '/product-images/real/tai-nghe.jpg', 'Tai nghe chưa ra mắt', 0),
  ('60000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', null, '/product-images/real/galaxy-buds3-pro.jpg', 'Samsung Galaxy Buds3 Pro', 0),
  ('60000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', null, '/product-images/real/dell-xps-15.jpg', 'Dell XPS 15 ngừng bán', 0),
  -- S3: ảnh cho sản phẩm mới (7–11)
  ('60000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000007', null, '/product-images/real/redmi-note-13.jpg', 'Xiaomi Redmi Note 13', 0),
  ('60000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000008', null, '/product-images/real/iphone-15.jpg', 'iPhone 15', 0),
  ('60000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000009', null, '/product-images/real/rog-strix-g16.jpg', 'Asus ROG Strix G16', 0),
  ('60000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', null, '/product-images/real/pc-proart.jpg', 'Asus PC Văn Phòng ProArt', 0),
  ('60000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-00000000000b', null, '/product-images/real/tuf-vg27.jpg', 'Asus TUF Gaming VG27', 0),
  ('60000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-00000000000c', null, '/product-images/real/viewfinity-s8.jpg', 'Samsung ViewFinity S8', 0),
  ('60000000-0000-0000-0000-00000000000d', '30000000-0000-0000-0000-00000000000d', null, '/product-images/real/jbl-flip-6.jpg', 'JBL Flip 6', 0),
  ('60000000-0000-0000-0000-00000000000e', '30000000-0000-0000-0000-00000000000e', null, '/product-images/real/sony-wh-1000xm5.jpg', 'Sony WH-1000XM5', 0),
  ('60000000-0000-0000-0000-00000000000f', '30000000-0000-0000-0000-00000000000f', null, '/product-images/real/apple-watch-se.jpg', 'Apple Watch SE', 0),
  ('60000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000010', null, '/product-images/real/iphone-12-cu.jpg', 'iPhone 12 cũ 99%', 0),
  ('60000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000011', null, '/product-images/real/dell-latitude-cu.jpg', 'Dell Latitude cũ like new', 0)
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
  ('70000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000006', 'Hiệu năng', 'CPU', 'Intel Core i7', 0),
  -- S3: specs cho sản phẩm mới (7–11)
  ('70000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000007', 'Pin', 'Dung lượng', '5000mAh', 0),
  ('70000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000008', 'Hiệu năng', 'Chip', 'Apple A16', 0),
  ('70000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000009', 'Hiệu năng', 'GPU', 'RTX 4060', 0),
  ('70000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000009', 'Màn hình', 'Tần số quét', '165Hz', 1),
  ('70000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-00000000000a', 'Hiệu năng', 'CPU', 'Intel Core i5', 0),
  ('70000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-00000000000b', 'Màn hình', 'Kích thước', '27 inch', 0),
  ('70000000-0000-0000-0000-000000000018', '30000000-0000-0000-0000-00000000000b', 'Màn hình', 'Tần số quét', '165Hz', 1),
  ('70000000-0000-0000-0000-000000000019', '30000000-0000-0000-0000-00000000000c', 'Màn hình', 'Độ phân giải', '4K UHD', 0),
  ('70000000-0000-0000-0000-00000000001a', '30000000-0000-0000-0000-00000000000d', 'Âm thanh', 'Chống nước', 'IP67', 0),
  ('70000000-0000-0000-0000-00000000001b', '30000000-0000-0000-0000-00000000000e', 'Âm thanh', 'Chống ồn', 'Chủ động cao cấp', 0),
  ('70000000-0000-0000-0000-00000000001c', '30000000-0000-0000-0000-00000000000e', 'Pin', 'Thời lượng', '30 giờ', 1),
  ('70000000-0000-0000-0000-00000000001d', '30000000-0000-0000-0000-00000000000f', 'Sức khỏe', 'Theo dõi', 'Nhịp tim, giấc ngủ', 0),
  ('70000000-0000-0000-0000-00000000001e', '30000000-0000-0000-0000-000000000010', 'Tình trạng', 'Ngoại hình', '99%', 0),
  ('70000000-0000-0000-0000-00000000001f', '30000000-0000-0000-0000-000000000010', 'Bảo hành', 'Thời hạn', '6 tháng riêng cho hàng cũ', 1),
  ('70000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000011', 'Tình trạng', 'Ngoại hình', 'Like New', 0),
  ('70000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000011', 'Bảo hành', 'Thời hạn', '6 tháng riêng cho hàng cũ', 1)
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
  ('80000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000006', 'van-phong'),
  -- S3: use cases cho sản phẩm mới (7–11)
  ('80000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000007', 'di-chuyen'),
  ('80000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000008', 'sang-tao'),
  ('80000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000009', 'gaming'),
  ('80000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-00000000000a', 'van-phong'),
  ('80000000-0000-0000-0000-00000000000d', '30000000-0000-0000-0000-00000000000b', 'gaming'),
  ('80000000-0000-0000-0000-00000000000e', '30000000-0000-0000-0000-00000000000c', 'thiet-ke'),
  ('80000000-0000-0000-0000-00000000000f', '30000000-0000-0000-0000-00000000000e', 'di-chuyen'),
  ('80000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000010', 'van-phong'),
  ('80000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000011', 'hoc-tap')
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
  '30000000-0000-0000-0000-000000000006',
  -- S3: publish sản phẩm mới (7–11) — mỗi sản phẩm đã có variant active ở trên.
  '30000000-0000-0000-0000-000000000007',
  '30000000-0000-0000-0000-000000000008',
  '30000000-0000-0000-0000-000000000009',
  '30000000-0000-0000-0000-00000000000a',
  '30000000-0000-0000-0000-00000000000b',
  '30000000-0000-0000-0000-00000000000c',
  '30000000-0000-0000-0000-00000000000d',
  '30000000-0000-0000-0000-00000000000e',
  '30000000-0000-0000-0000-00000000000f',
  '30000000-0000-0000-0000-000000000010',
  '30000000-0000-0000-0000-000000000011'
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

-- Flash sale demo offers (deterministic UUIDs; ends_at relative to reset time
-- so the homepage countdown is always live after `supabase db reset`).
insert into flash_offers (id, product_id, title, badge, starts_at, ends_at, sort_order, is_active) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Galaxy S24 Ultra giảm sốc', '⚡ Deal hot', now() - interval '1 hour', now() + interval '3 days', 0, true),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', 'Buds3 Pro giá tốt', '⚡ Flash', now() - interval '1 hour', now() + interval '2 days', 1, true),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'MacBook Air M3 tuần lễ vàng', '⚡ Flash', now() - interval '1 hour', now() + interval '5 days', 2, true);
