-- S3: cụm sản phẩm theo ngành hàng (DESIGN_CELLPHONES_INSPIRED.md §4.6–§4.11).
--
-- Six new homepage sections slot between the existing laptop rail (sort_order
-- 70) and the editorial section (90):
--
--   §4.6  Điện thoại nổi bật   → deal_tabs (tabs = thương hiệu)
--   §4.7  Laptop nổi bật       → deal_tabs (tabs = nhu cầu sử dụng)
--   §4.8  PC và màn hình       → product_collection (rail)
--   §4.9  Âm thanh và wearable → product_collection (rail)
--   §4.10 Phụ kiện             → category_mosaic (existing renderer; hard-coded
--                                sub-groups already match CATEGORY_EXPLORER's
--                                shape, no new section_type needed)
--   §4.11 Hàng cũ              → product_collection (grid, its own category)
--
-- All collections are dynamic (featured/newest by category or brand filter),
-- so a demo reset never needs a second migration to keep them populated: they
-- resolve against whatever the catalog actually has at request time.

-- ─── section_type allow-list ─────────────────────────────────────────────────

-- Adds `accessory_mosaic` (§4.10): a config-driven mosaic of small accessory
-- groups, distinct from `category_mosaic` which renders a fixed top-level
-- category list and would otherwise repeat itself if reused here.
alter table homepage_sections
  drop constraint if exists homepage_sections_section_type_check;

alter table homepage_sections
  add constraint homepage_sections_section_type_check check (
    section_type in (
      'hero',
      'banner_grid',
      'campaign_links',
      'member_block',
      'category_mosaic',
      'category_grid',
      'deal_tabs',
      'product_collection',
      'accessory_mosaic',
      'need_selector',
      'brand_strip',
      'editorial',
      'trust',
      'guides',
      'newsletter',
      'flash_sale',
      'recently_viewed'
    )
  );

-- ─── homepage_collections ────────────────────────────────────────────────────

insert into homepage_collections (id, slug, title, subtitle, collection_type, filters, sort_order)
values
  -- §4.6: tabs thương hiệu cho điện thoại.
  (
    '43000000-0000-0000-0000-000000000005',
    'dien-thoai-apple',
    'Điện thoại Apple',
    'iPhone chọn lọc.',
    'featured',
    '{"categorySlug":"dien-thoai","brandSlug":"apple"}',
    50
  ),
  (
    '43000000-0000-0000-0000-000000000006',
    'dien-thoai-samsung',
    'Điện thoại Samsung',
    'Galaxy chọn lọc.',
    'featured',
    '{"categorySlug":"dien-thoai","brandSlug":"samsung"}',
    51
  ),
  (
    '43000000-0000-0000-0000-000000000007',
    'dien-thoai-xiaomi',
    'Điện thoại Xiaomi',
    'Tầm trung đáng mua.',
    'featured',
    '{"categorySlug":"dien-thoai","brandSlug":"xiaomi"}',
    52
  ),
  -- §4.7: tabs theo nhu cầu cho laptop (bổ sung cho "laptop-chon-loc" theo danh mục).
  (
    '43000000-0000-0000-0000-000000000008',
    'laptop-gaming',
    'Laptop Gaming',
    'Hiệu năng cao, tản nhiệt tốt.',
    'featured',
    '{"categorySlug":"laptop","useCase":"gaming"}',
    53
  ),
  (
    '43000000-0000-0000-0000-000000000009',
    'laptop-van-phong',
    'Laptop Văn Phòng',
    'Mỏng nhẹ, pin tốt cho công việc hàng ngày.',
    'featured',
    '{"categorySlug":"laptop","useCase":"van-phong"}',
    54
  ),
  (
    '43000000-0000-0000-0000-00000000000a',
    'laptop-hoc-tap',
    'Laptop Sinh Viên',
    'Nhẹ, pin lâu, giá hợp lý cho học tập.',
    'featured',
    '{"categorySlug":"laptop","useCase":"hoc-tap"}',
    55
  ),
  -- §4.8: PC và màn hình.
  (
    '43000000-0000-0000-0000-00000000000b',
    'pc-noi-bat',
    'PC nổi bật',
    'Máy bộ cho văn phòng và đa nhiệm.',
    'featured',
    '{"categorySlug":"pc"}',
    56
  ),
  (
    '43000000-0000-0000-0000-00000000000c',
    'man-hinh-noi-bat',
    'Màn hình nổi bật',
    'Gaming và đồ họa.',
    'featured',
    '{"categorySlug":"man-hinh"}',
    57
  ),
  -- §4.9: âm thanh và wearable.
  (
    '43000000-0000-0000-0000-00000000000d',
    'am-thanh-noi-bat',
    'Âm thanh nổi bật',
    'Tai nghe và loa chọn lọc.',
    'featured',
    '{"categorySlug":"am-thanh"}',
    58
  ),
  (
    '43000000-0000-0000-0000-00000000000e',
    'wearable-noi-bat',
    'Đồng hồ thông minh',
    'Theo dõi sức khỏe mỗi ngày.',
    'featured',
    '{"categorySlug":"dong-ho"}',
    59
  ),
  -- §4.11: hàng cũ — danh mục riêng, không trộn với hàng mới.
  (
    '43000000-0000-0000-0000-00000000000f',
    'hang-cu-noi-bat',
    'Hàng cũ đã kiểm định',
    'Đã kiểm định 15 điểm, bảo hành riêng 6 tháng.',
    'newest',
    '{"categorySlug":"hang-cu"}',
    60
  )
on conflict (id) do nothing;

-- ─── homepage_sections ───────────────────────────────────────────────────────

insert into homepage_sections (id, section_key, section_type, eyebrow, title, subtitle, sort_order, config)
values
  -- §4.6 Điện thoại nổi bật — tabs thương hiệu.
  (
    '44000000-0000-0000-0000-00000000000f',
    'phones-featured',
    'deal_tabs',
    'Điện thoại',
    'Điện thoại nổi bật',
    'Chọn theo thương hiệu bạn đang dùng.',
    71,
    '{"tabs":[{"label":"Apple","collectionSlug":"dien-thoai-apple"},{"label":"Samsung","collectionSlug":"dien-thoai-samsung"},{"label":"Xiaomi","collectionSlug":"dien-thoai-xiaomi"}],"limit":8}'
  ),
  -- §4.7 Laptop nổi bật — tabs theo nhu cầu sử dụng.
  (
    '44000000-0000-0000-0000-000000000017',
    'laptops-featured',
    'deal_tabs',
    'Laptop',
    'Laptop nổi bật',
    'Gaming, văn phòng hay sinh viên — chọn theo nhu cầu.',
    72,
    '{"tabs":[{"label":"Gaming","collectionSlug":"laptop-gaming"},{"label":"Văn phòng","collectionSlug":"laptop-van-phong"},{"label":"Sinh viên","collectionSlug":"laptop-hoc-tap"}],"limit":8}'
  ),
  -- §4.8 PC và màn hình.
  (
    '44000000-0000-0000-0000-000000000018',
    'pc-rail',
    'product_collection',
    'PC & màn hình',
    'PC nổi bật',
    'Máy bộ chọn lọc cho văn phòng và đa nhiệm.',
    73,
    '{"collectionSlug":"pc-noi-bat","limit":8,"layout":"rail"}'
  ),
  (
    '44000000-0000-0000-0000-000000000012',
    'monitor-rail',
    'product_collection',
    'PC & màn hình',
    'Màn hình nổi bật',
    'Gaming và đồ họa, tần số quét cao.',
    74,
    '{"collectionSlug":"man-hinh-noi-bat","limit":8,"layout":"rail"}'
  ),
  -- §4.9 Âm thanh và wearable.
  (
    '44000000-0000-0000-0000-000000000013',
    'audio-rail',
    'product_collection',
    'Âm thanh & wearable',
    'Âm thanh nổi bật',
    'Tai nghe và loa chọn lọc.',
    75,
    '{"collectionSlug":"am-thanh-noi-bat","limit":8,"layout":"rail"}'
  ),
  (
    '44000000-0000-0000-0000-000000000014',
    'wearable-rail',
    'product_collection',
    'Âm thanh & wearable',
    'Đồng hồ thông minh',
    'Theo dõi sức khỏe mỗi ngày.',
    76,
    '{"collectionSlug":"wearable-noi-bat","limit":8,"layout":"rail"}'
  ),
  -- §4.11 Hàng cũ — cam kết tình trạng + bảo hành riêng nằm trong subtitle/spec
  -- của từng sản phẩm (product_specs group "Tình trạng"/"Bảo hành"), không bịa
  -- badge hay countdown giả ở section này.
  (
    '44000000-0000-0000-0000-000000000015',
    'used-rail',
    'product_collection',
    'Hàng cũ',
    'Hàng cũ đã kiểm định',
    'Đã kiểm định 15 điểm, bảo hành riêng 6 tháng — xem chi tiết tình trạng trong trang sản phẩm.',
    77,
    '{"collectionSlug":"hang-cu-noi-bat","limit":8,"layout":"grid"}'
  ),
  -- §4.10 Phụ kiện — mosaic nhóm nhỏ, mỗi ô là một filter catalog có thật
  -- (category=phu-kien kết hợp brand hoặc useCase đã tồn tại trong seed).
  (
    '44000000-0000-0000-0000-000000000016',
    'accessories-mosaic',
    'accessory_mosaic',
    'Phụ kiện',
    'Phụ kiện theo nhóm',
    'Tai nghe, loa, phụ kiện văn phòng — chọn nhanh theo nhu cầu.',
    78,
    '{"items":[{"label":"Tai nghe & loa","categorySlug":"am-thanh"},{"label":"Đồng hồ thông minh","categorySlug":"dong-ho"},{"label":"Phụ kiện văn phòng","categorySlug":"phu-kien","useCase":"van-phong"},{"label":"Phụ kiện giải trí","categorySlug":"phu-kien","useCase":"giai-tri"},{"label":"JBL","brandSlug":"jbl"},{"label":"Sony","brandSlug":"sony"}]}'
  )
on conflict (id) do nothing;
