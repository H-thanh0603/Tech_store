-- Storefront content seed (S1A): moves the homepage structure and navigation out
-- of hard-coded components into the content tables created by
-- 202607260015_content_foundation.sql.
--
-- Seed rules:
--   * Every href points at a route that exists and a category/product that is
--     really published — no placeholder links.
--   * Banners carry no image URLs: there are no real creatives yet, and the
--     renderer degrades to a typographic card rather than showing a fake one.
--   * Deterministic UUIDs so re-running is idempotent (on conflict do nothing).
--   * Product collections are populated from published, non-archived products
--     only, so an empty collection is dropped by the query layer instead of
--     rendering an empty rail.

-- ─── navigation_items ────────────────────────────────────────────────────────

-- Top-level category entries. metadata.categorySlug is cross-checked against
-- live categories by lib/content/queries.ts, so a deactivated category drops
-- out of the menu automatically.
insert into navigation_items (id, parent_id, label, href, item_type, icon_key, sort_order, metadata)
values
  ('40000000-0000-0000-0000-000000000001', null, 'Điện thoại', '/products?category=dien-thoai', 'category', 'smartphone', 10, '{"categorySlug":"dien-thoai"}'),
  ('40000000-0000-0000-0000-000000000002', null, 'Laptop', '/products?category=laptop', 'category', 'laptop', 20, '{"categorySlug":"laptop"}'),
  ('40000000-0000-0000-0000-000000000003', null, 'Phụ kiện', '/products?category=phu-kien', 'category', 'headphones', 30, '{"categorySlug":"phu-kien"}'),
  ('40000000-0000-0000-0000-000000000004', null, 'Khuyến mãi', '/products?sort=price-asc', 'promo', 'tag', 40, '{}'),
  ('40000000-0000-0000-0000-000000000005', null, 'Tra cứu đơn', '/track-order', 'link', 'truck', 50, '{}')
on conflict (id) do nothing;

-- Second level: use-case entries under each category. These map onto real
-- catalog filters (useCase / category), so every link returns a real result set.
insert into navigation_items (id, parent_id, label, href, item_type, sort_order, metadata)
values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Chụp ảnh tốt', '/products?category=dien-thoai&useCase=sang-tao', 'link', 10, '{}'),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Pin dùng lâu', '/products?category=dien-thoai&useCase=di-chuyen', 'link', 20, '{}'),
  ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'Học tập', '/products?category=laptop&useCase=hoc-tap', 'link', 10, '{}'),
  ('41000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Lập trình', '/products?category=laptop&useCase=lap-trinh', 'link', 20, '{}'),
  ('41000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', 'Văn phòng', '/products?category=laptop&useCase=van-phong', 'link', 30, '{}'),
  ('41000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', 'Sáng tạo', '/products?category=laptop&useCase=sang-tao', 'link', 40, '{}'),
  ('41000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', 'Tai nghe', '/products?category=phu-kien', 'link', 10, '{}'),
  ('41000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000003', 'Bàn phím & chuột', '/products?category=phu-kien&useCase=van-phong', 'link', 20, '{}')
on conflict (id) do nothing;

-- ─── banners ─────────────────────────────────────────────────────────────────

insert into banners (id, name, slot, title, subtitle, href, sort_order)
values
  (
    '42000000-0000-0000-0000-000000000001',
    'Hero — catalog',
    'home_hero',
    'Công nghệ chọn lọc — mua nhanh, hiểu rõ',
    'Giá VND minh bạch, tồn kho thật, COD hoặc chuyển khoản.',
    '/products',
    10
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    'Promo — laptop',
    'home_promo_grid',
    'Máy học & làm việc chọn lọc',
    'Pin tốt, màn rõ, giá VND minh bạch.',
    '/products?category=laptop',
    10
  ),
  (
    '42000000-0000-0000-0000-000000000003',
    'Promo — điện thoại',
    'home_promo_grid',
    'Điện thoại dùng mỗi ngày',
    'Chụp ảnh, xem phim, app mượt.',
    '/products?category=dien-thoai',
    20
  ),
  (
    '42000000-0000-0000-0000-000000000004',
    'Promo — phụ kiện',
    'home_promo_grid',
    'Phụ kiện nâng trải nghiệm',
    'Tai nghe, bàn phím, chuột — dễ kết nối.',
    '/products?category=phu-kien',
    30
  ),
  (
    '42000000-0000-0000-0000-000000000005',
    'Campaign — tra cứu đơn',
    'home_campaign_strip',
    'Theo dõi đơn hàng',
    'Tra cứu bằng mã đơn, không cần đăng nhập.',
    '/track-order',
    10
  ),
  (
    '42000000-0000-0000-0000-000000000006',
    'Campaign — tài khoản',
    'home_campaign_strip',
    'Tài khoản TechStore',
    'Lưu wishlist, so sánh và lịch sử đơn.',
    '/account',
    20
  )
on conflict (id) do nothing;

-- ─── homepage_collections ────────────────────────────────────────────────────

insert into homepage_collections (id, slug, title, subtitle, collection_type, sort_order)
values
  (
    '43000000-0000-0000-0000-000000000001',
    'noi-bat',
    'Thiết bị đang có trong kho',
    'Giá và tồn kho lấy trực tiếp từ database.',
    'manual',
    10
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    'laptop-chon-loc',
    'Laptop chọn lọc',
    'Học tập, lập trình và văn phòng.',
    'manual',
    20
  )
on conflict (id) do nothing;

-- Items are derived from the catalog rather than listed by id, so the seed
-- cannot reference a product that is unpublished or archived.
insert into homepage_collection_items (collection_id, product_id, sort_order)
select
  '43000000-0000-0000-0000-000000000001',
  p.id,
  (row_number() over (order by p.is_featured desc, p.created_at desc, p.id)) * 10
from products p
where p.is_published and not p.is_archived
on conflict (collection_id, product_id) do nothing;

insert into homepage_collection_items (collection_id, product_id, sort_order)
select
  '43000000-0000-0000-0000-000000000002',
  p.id,
  (row_number() over (order by p.is_featured desc, p.created_at desc, p.id)) * 10
from products p
join categories c on c.id = p.category_id
where p.is_published and not p.is_archived and c.slug = 'laptop'
on conflict (collection_id, product_id) do nothing;

-- ─── homepage_sections ───────────────────────────────────────────────────────

-- sort_order leaves gaps of 10 so a section can be inserted between two others
-- without renumbering the whole page.
insert into homepage_sections (id, section_key, section_type, eyebrow, title, subtitle, sort_order, config)
values
  (
    '44000000-0000-0000-0000-000000000001',
    'hero',
    'hero',
    'Editorial tech · Guest checkout',
    'Công nghệ chọn lọc — mua nhanh, hiểu rõ.',
    'Gợi ý thiết bị theo nhu cầu thật: học tập, code, sáng tạo hay di chuyển.',
    10,
    '{"bannerSlot":"home_hero","ctaLabel":"Khám phá catalog","ctaHref":"/products","showStats":true}'
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    'promo-grid',
    'banner_grid',
    null,
    null,
    null,
    20,
    '{"bannerSlot":"home_promo_grid","limit":3}'
  ),
  (
    '44000000-0000-0000-0000-000000000003',
    'flash-sale',
    'flash_sale',
    'Ưu đãi có hạn',
    'Deal đang chạy',
    'Chỉ hiển thị khi có ưu đãi thật đang trong thời gian áp dụng.',
    30,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-000000000004',
    'categories',
    'category_mosaic',
    'Khám phá',
    'Mua theo danh mục',
    'Lối vào nhanh theo ngành hàng.',
    40,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-000000000005',
    'featured',
    'product_collection',
    'Đáng xem',
    'Thiết bị đang có trong kho',
    null,
    50,
    '{"collectionSlug":"noi-bat","limit":8,"layout":"grid"}'
  ),
  (
    '44000000-0000-0000-0000-000000000006',
    'need-selector',
    'need_selector',
    'Gợi ý thông minh',
    'Chọn nhu cầu, chúng tôi gợi ý thiết bị',
    'Rule-based theo use case trong catalog — không bịa review hay scarcity.',
    60,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-000000000007',
    'laptop-rail',
    'product_collection',
    'Laptop',
    'Laptop chọn lọc',
    null,
    70,
    '{"collectionSlug":"laptop-chon-loc","limit":8,"layout":"rail"}'
  ),
  (
    '44000000-0000-0000-0000-000000000008',
    'campaign-strip',
    'banner_grid',
    null,
    null,
    null,
    80,
    '{"bannerSlot":"home_campaign_strip","limit":2}'
  ),
  (
    '44000000-0000-0000-0000-000000000009',
    'editorial',
    'editorial',
    'Editorial',
    'Máy tốt không chỉ là thông số — là việc bạn làm được mỗi ngày.',
    'TechStore diễn giải lợi ích: mang đi học, code cả ngày, chỉnh video, hay chơi game.',
    90,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-00000000000a',
    'brands',
    'brand_strip',
    'Brand universe',
    'Thương hiệu tại TechStore',
    null,
    100,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-00000000000b',
    'trust',
    'trust',
    'Tin cậy',
    'Cam kết mua sắm rõ ràng',
    'Không fake review, không countdown giả, không số liệu bịa.',
    110,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-00000000000c',
    'guides',
    'guides',
    'Hướng dẫn',
    'Chọn máy không cần “rành công nghệ”',
    'Bài ngắn dẫn tới catalog đã lọc — nội dung thật, CTA rõ.',
    120,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-00000000000d',
    'recently-viewed',
    'recently_viewed',
    'Vừa xem',
    'Bạn đã xem gần đây',
    null,
    130,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-00000000000e',
    'newsletter',
    'newsletter',
    'Price alert',
    'Nhận thông báo khi máy bạn quan tâm giảm giá',
    null,
    140,
    '{}'
  )
on conflict (id) do nothing;
